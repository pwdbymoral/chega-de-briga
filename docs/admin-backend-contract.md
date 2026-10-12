# Contrato do backend administrativo

Este documento define o domínio administrativo e as métricas usadas por `apps/web/src/admin`. O gateway de produção e as rotas protegidas existem; `/admin` usa o backend no build de produção e mantém dados simulados somente no Vite de desenvolvimento. A implantação ainda precisa ser verificada. A arquitetura, autenticação, retenção e provisionamento ficam em [backend-deployment-contract-v1.md](./backend-deployment-contract-v1.md); as regras do produto residencial ficam em [modelagem-mobile-v1.md](./modelagem-mobile-v1.md).

## Entidades e relações

| Entidade | Campos essenciais | Chaves e restrições |
| --- | --- | --- |
| `accounts` | `id`, `email`, `password_hash`, `email_verified_at`, `created_at` | identidade canônica; e-mail normalizado e único; uma senha compartilhada por todos os papéis da identidade |
| `users` | `id`, `account_id`, `name`, `status`, `source`, `access_id`, `created_at`, `last_seen_at` | papel residencial ligado a `accounts`; um registro por identidade; estado `ativo`, `suspenso`, `excluido` |
| `platform_admins` | `id`, `account_id`, `totp_secret`, `created_at`, `last_seen_at` | papel administrativo ligado à mesma identidade; TOTP obrigatório; sessão própria; papel residencial não concede administração |
| `households` | `id`, `name`, `timezone`, `created_at`, `created_by_user_id`, `first_value_at`, `first_value_type` | `id` imutável; fuso IANA definido na criação; primeiro valor imutável para orientar o primeiro uso e medir ativação |
| `memberships` | `user_id`, `household_id`, `role`, `joined_at` | FK para as duas entidades; par `(user_id, household_id)` único; papel `responsavel` ou `morador`; casa com pelo menos um responsável ativo |
| `access_grants` | `id`, `email`, `source`, `created_at` | concessão histórica; origem `lista`, `convite_admin`, `convite_morador` ou `publico`; `users.access_id` preserva o vínculo mesmo após mudança de e-mail |
| `allow_entries` | `id`, `access_grant_id`, `revoked_at`, `created_by` | FK única para concessão; uma autorização ativa por e-mail; revogação não altera conta já criada |
| `invitations` | `id`, `access_grant_id`, `household_id`, `inviter_user_id`, `status`, `expires_at`, `accepted_at`, `revoked_at` | FK única para concessão; convite de morador exige casa e convidador membro ativo; expiração após 7 dias; token secreto armazenado **somente como hash**, nunca no payload administrativo |
| `task_metadata` | `id`, `household_id`, `created_at`, `due_at`, `completed_at`, `is_open` | campos necessários para métricas; não entram títulos ou descrições nas respostas do console |
| `activity_events` | `id`, `event_type`, `user_id?`, `household_id?`, `occurred_at` | eventos append-only com idempotência por ID; tipos abaixo |
| `admin_audit_events` | `id`, `actor_admin_id`, `action`, `target_type`, `target_id`, `occurred_at`, `request_id` | append-only; nunca incluir senha, token ou conteúdo doméstico |
| `waitlist_contacts` | `id`, `channel`, `contact`, `consent_at`, `consent_version`, `utm_source?`, `utm_medium?`, `utm_campaign?`, `created_at` | PII separada dos eventos; canal + contato normalizados únicos; consentimento explícito; remoção administrativa; sem exportação |
| `public_landing_events` | `id`, `event_type`, `channel?`, tags de campanha opcionais, `occurred_at` | somente carregamento da landing, início do formulário e inscrição; sem visitante, IP, user agent ou conteúdo digitado |
| `app_settings` | `key`, `value`, `updated_at` | guarda a primeira data de abertura pública para expurgar a lista 90 dias depois |

IDs são opacos, estáveis e não devem codificar e-mail. Timestamps são ISO 8601 UTC. Endereços exibidos nos contratos administrativos são lidos da identidade `accounts`, não duplicados em `users`. Uma identidade pode ter os dois papéis e usa a mesma senha; a sessão administrativa exige TOTP e não reutiliza o cookie residencial. O TOTP só é solicitado depois que o servidor valida e-mail e senha; o desafio temporário é enviado em cookie HttpOnly e só pode ser consumido uma vez, em até cinco minutos. O banco guarda apenas o hash do desafio.

## Entrada restrita

O cadastro público começa fechado. Há três caminhos de elegibilidade:

1. Um e-mail ativo na lista de autorização permite criar conta.
2. Um convite válido, não aceito e não revogado permite criar conta. Convite de morador vinculado a uma casa também cria o vínculo naquela casa, sem aprovação manual. A aceitação do convite e a criação do vínculo devem ocorrer na mesma transação.
3. Quando `PUBLIC_SIGNUP_ENABLED=true` no servidor, qualquer pessoa pode iniciar cadastro. A origem é `publico`; a verificação de e-mail continua obrigatória. Com a flag desligada, convites e autorizações existentes continuam válidos.

O servidor deve validar token, e-mail, expiração e estado em cada aceitação, limitar tentativas e consumo duplicado, e registrar quem convidou. Pode haver convites válidos para casas diferentes; impedir duplicação de convite pendente para o mesmo par e-mail/casa. Convites de moradores só podem ser criados por um membro ativo da própria casa; administradores podem criar convites gerais ou vinculados. Reenvio revoga o token anterior e cria outro com nova validade de sete dias. Revogar lista ou convite pendente **não** suspende uma conta já criada. Suspensão de conta é operação separada.

O login administrativo precisa de autenticação real com sessão segura e papel de plataforma separado de `memberships.role`. Nenhuma pessoa recebe permissão de plataforma por ser responsável por uma casa. Uma identidade admin que também tenha papel residencial acessa conteúdo doméstico somente pela própria sessão residencial e pelos vínculos explícitos. Autorizar leitura e escrita no servidor, negar por padrão, auditar mudanças e evitar retornar dados sensíveis no payload.

## Operações esperadas pelo `AdminGateway`

O tipo TypeScript em `apps/web/src/admin/contracts.ts` é o contrato de apresentação; `apps/web/src/admin/httpGateway.ts` mapeia as operações para as rotas reais. O gateway deve preservar semântica e estados de erro:

| Método e rota | Entrada | Saída / regra |
| --- | --- | --- |
| `POST /api/admin/session/challenge` | e-mail e senha | se corretos, retorna `requiresTotp: true` e cria desafio temporário em cookie HttpOnly; não cria sessão |
| `POST /api/admin/session/verify` | TOTP ou código de recuperação + cookie de desafio | consome o código de recuperação se usado e cria a sessão administrativa |
| `GET /api/admin/session`, `DELETE /api/admin/session` | — | estado da sessão / encerramento |
| `GET /api/admin/users` | `search`, `status`, `page`, `page_size` | `items`, `total`, `page`, `pages`; ordenação estável; busca por nome/e-mail |
| `GET /api/admin/users/:id` | ID | perfil, vínculos, metadados de atividade e auditoria pertinente; sem conteúdo de tarefas |
| `PATCH /api/admin/users/:id` | nome, e-mail | perfil atualizado; mudança de e-mail exige nova verificação; bloqueada se afetar identidade que também tem papel admin |
| `PATCH /api/admin/users/:id/status` | `active` ou `suspended` | estado atualizado; não deixar casa sem responsável ativo |
| `PATCH /api/admin/households/:id/members/:userId` | `role` | vínculo atualizado; transação protege último responsável |
| `GET /api/admin/access` | paginação e filtros futuros | lista de autorizações e convites, inclusive convites de moradores |
| `POST /api/admin/allow-entries`, `DELETE /api/admin/allow-entries/:id` | e-mail / ID | criar ou revogar autorização |
| `POST /api/admin/invitations`, `POST /api/admin/invitations/:id/resend`, `DELETE /api/admin/invitations/:id` | e-mail, casa opcional / ID | criar, reenviar ou revogar; usar o outbox do contrato de backend/deploy |
| `GET /api/admin/households`, `GET /api/admin/households/:id` | filtros e paginação futuros / ID | casa, membros, contagens e eventos permitidos; sem títulos, descrições ou anexos |
| `GET /api/admin/analytics` | `period=7|30|90`, `source`, `size` | agregados, denominadores, intervalo, coortes, série e insights explicáveis |
| `GET /api/admin/waitlist/analytics` | `period=7|30|90` | carregamentos da landing, inícios, inscrições, taxa carregamentos→inscrições, canal, campanha, série diária e funil público agregado quando aberto |
| `GET /api/admin/waitlist` | `search`, `channel`, `campaign`, `page`, `page_size` | lista paginada de contatos autorizados; buscar por contato ou campanha; sem endpoint de exportação |
| `DELETE /api/admin/waitlist/:id` | ID opaco | remove um contato e audita ação sem copiar o contato para o log |
| `GET /api/public/config` | — | retorna apenas se o cadastro público está habilitado no servidor |
| `POST /api/public/landing-events` | `view` ou `form_start`, tags de campanha e canal opcional | grava apenas eventos agregados de produto; rate limit |
| `POST /api/waitlist` | canal, contato, consentimento e tags de campanha | valida, normaliza, deduplica, limita requisições e responde de forma igual para novos e repetidos; honeypot não grava lead |
| Exportar CSV | Gerado no cliente a partir de `GET /api/admin/analytics` | Contém apenas os agregados já retornados pela API. |

Erros estruturados: `{ code, message, request_id }`. Códigos mínimos: `unauthenticated` (401), `invalid_totp` (401), `forbidden` (403), `not_found` (404), `duplicate_email` (409), `sole_owner` (409), `invalid_state` (409), `validation` (422), `rate_limited` (429). Não diferenciar publicamente e-mail existente de inexistente em fluxos de cadastro e convite. Listagens devem impor tamanho de página máximo, filtros validados e ordenação determinística. Para atomicidade, auditoria e idempotência, seguir o contrato de backend/deploy.

## Eventos e métricas

Eventos atuais: `conta_criada`, `acesso`, `entrada_casa`, `tarefa_criada`, `tarefa_concluida`, `tarefa_pulada`, `tarefa_editada` e `item_compra_adicionado`. Associar `occurred_at`, `user_id?`, `household_id?` e ID único; não guardar conteúdo de tarefa/lista em eventos. Mudanças administrativas usam `admin_audit_events`, separado da atividade de produto. Eventos de lista de espera ficam na tabela agregada separada e não contêm contato.

Todas as métricas usam intervalo UTC fechado no fim e origem/tamanho selecionados. O frontend exibe intervalo e denominadores. O backend deve retornar agregados, não linhas brutas:

- **Funil de acesso por pessoa:** e-mails únicos que receberam autorização ou convite no período, inclusive se o acesso depois expirou ou foi revogado → contas criadas a partir dessas concessões no período → pessoas desse grupo que entraram em uma casa. Relacionar conta e concessão por ID imutável, nunca pelo e-mail editável. A taxa de cada etapa usa a anterior. Para segmentar por tamanho da casa, pessoas que ainda não entraram em casa não têm tamanho conhecido; a interface da demo as exclui desse filtro. O backend pode optar por uma dimensão explícita `unknown` e deve documentá-la.
- **Funil de ativação por casa:** casas criadas no período com pelo menos sete dias completos de observação → duas pessoas vinculadas em até sete dias da criação → primeira tarefa criada nesse prazo → primeira conclusão nesse prazo. Cada taxa usa a etapa anterior. Contar casas distintas, não eventos.
- **Primeiro valor:** casas criadas no período com pelo menos sete dias completos de observação → tarefa/rotina ou primeiro item de compras registrado na casa em até sete dias. Cada taxa usa a etapa anterior; contar casas distintas. O timestamp persistente é `households.first_value_at`, e não depende da retenção dos eventos analíticos.
- **Landing e espera:** mostrar carregamentos da página, inícios do formulário, inscrições válidas e conversão carregamentos→inscrições. A unidade é carregamento, não visitante único; recarregamentos contam. Canal e campanha são agregados. Não associar contatos da espera a contas. Depois da abertura, exibir landing → contas públicas → casas → primeiro valor como coorte agregada, sem pareamento individual.
- **Casa ativa:** ao menos uma criação/conclusão de tarefa ou inclusão de item de compras na semana. Série semanal inclui no denominador casas existentes no fim da semana do segmento. A última semana pode ser parcial.
- **Retenção:** casas criadas no período selecionado, agrupadas pela semana de criação. Semana 1 corresponde aos dias 7–13 após criação; semana 4 aos dias 28–34. Denominador de cada célula inclui apenas casas que completaram 14 ou 35 dias, respectivamente. Mostrar `—` quando ainda não houve tempo suficiente. Para comparar semana 1 e 4, usar **o mesmo conjunto** de casas maduras de 35 dias. Assim, o filtro de 90 dias é necessário para visualizar semana 4.
- **Acúmulo:** tarefas sem `completed_at` e `due_at` anterior ao instante da consulta, com denominador de todas as tarefas abertas nas casas do segmento. Nenhum título de tarefa é necessário.
- **Insights:** maior queda absoluta entre etapas, diferença descritiva de retenção no mesmo grupo e proporção de vencidas em aberto. Se menos de dez casas maduras no funil, sinalizar amostra pequena e evitar conclusões fortes. Sinais de precificação são hipóteses de uso por tamanho, sem estimar receita ou disposição a pagar.

O CSV existente contém somente agregados analíticos. A lista de espera não oferece exportação, em API ou cliente. Contatos só são acessíveis no console admin protegido, e a exclusão fica auditada por ID opaco.

## Estados da interface e limites atuais

`AdminGateway` é assíncrono; a interface trata carregamento, vazio, erro e sucesso. TanStack Query invalida consultas relacionadas após mutações. O gateway demo mantém alterações em memória e não envia e-mail; o build de produção conecta ao backend e não inclui fixtures nem credenciais demo. O cadastro permanece restrito por padrão; a flag de servidor abre o cadastro público sem remover verificação de e-mail ou caminhos de convite.
