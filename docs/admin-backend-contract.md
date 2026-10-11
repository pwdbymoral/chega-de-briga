# Contrato do backend administrativo

Este documento define o domínio administrativo e as métricas usadas por `apps/web/src/admin`. O gateway de produção e as rotas protegidas existem; `/admin` usa o backend no build de produção e mantém dados simulados somente no Vite de desenvolvimento. A implantação ainda precisa ser verificada. A arquitetura, autenticação, retenção e provisionamento ficam em [backend-deployment-contract-v1.md](./backend-deployment-contract-v1.md); as regras do produto residencial ficam em [modelagem-mobile-v1.md](./modelagem-mobile-v1.md).

## Entidades e relações

| Entidade | Campos essenciais | Chaves e restrições |
| --- | --- | --- |
| `accounts` | `id`, `email`, `password_hash`, `email_verified_at`, `created_at` | identidade canônica; e-mail normalizado e único; uma senha compartilhada por todos os papéis da identidade |
| `users` | `id`, `account_id`, `name`, `status`, `source`, `access_id`, `created_at`, `last_seen_at` | papel residencial ligado a `accounts`; um registro por identidade; estado `ativo`, `suspenso`, `excluido` |
| `platform_admins` | `id`, `account_id`, `totp_secret`, `created_at`, `last_seen_at` | papel administrativo ligado à mesma identidade; TOTP obrigatório; sessão própria; papel residencial não concede administração |
| `households` | `id`, `name`, `timezone`, `created_at` | `id` imutável; fuso IANA definido na criação e usado para datas residenciais |
| `memberships` | `user_id`, `household_id`, `role`, `joined_at` | FK para as duas entidades; par `(user_id, household_id)` único; papel `responsavel` ou `morador`; casa com pelo menos um responsável ativo |
| `access_grants` | `id`, `email`, `source`, `created_at` | concessão histórica; origem `lista`, `convite_admin` ou `convite_morador`; `users.access_id` preserva o vínculo mesmo após mudança de e-mail |
| `allow_entries` | `id`, `access_grant_id`, `revoked_at`, `created_by` | FK única para concessão; uma autorização ativa por e-mail; revogação não altera conta já criada |
| `invitations` | `id`, `access_grant_id`, `household_id`, `inviter_user_id`, `status`, `expires_at`, `accepted_at`, `revoked_at` | FK única para concessão; convite de morador exige casa e convidador membro ativo; expiração após 7 dias; token secreto armazenado **somente como hash**, nunca no payload administrativo |
| `task_metadata` | `id`, `household_id`, `created_at`, `due_at`, `completed_at`, `is_open` | campos necessários para métricas; não entram títulos ou descrições nas respostas do console |
| `activity_events` | `id`, `event_type`, `user_id?`, `household_id?`, `occurred_at` | eventos append-only com idempotência por ID; tipos abaixo |
| `admin_audit_events` | `id`, `actor_admin_id`, `action`, `target_type`, `target_id`, `occurred_at`, `request_id` | append-only; nunca incluir senha, token ou conteúdo doméstico |

IDs são opacos, estáveis e não devem codificar e-mail. Timestamps são ISO 8601 UTC. Endereços exibidos nos contratos administrativos são lidos da identidade `accounts`, não duplicados em `users`. Uma identidade pode ter os dois papéis e usa a mesma senha; a sessão administrativa exige TOTP e não reutiliza o cookie residencial. Política de exclusão e retenção está no contrato de backend/deploy.

## Entrada restrita

O cadastro público começa fechado. Há dois caminhos de elegibilidade:

1. Um e-mail ativo na lista de autorização permite criar conta.
2. Um convite válido, não aceito e não revogado permite criar conta. Convite de morador vinculado a uma casa também cria o vínculo naquela casa, sem aprovação manual. A aceitação do convite e a criação do vínculo devem ocorrer na mesma transação.

O servidor deve validar token, e-mail, expiração e estado em cada aceitação, limitar tentativas e consumo duplicado, e registrar quem convidou. Pode haver convites válidos para casas diferentes; impedir duplicação de convite pendente para o mesmo par e-mail/casa. Convites de moradores só podem ser criados por um membro ativo da própria casa; administradores podem criar convites gerais ou vinculados. Reenvio revoga o token anterior e cria outro com nova validade de sete dias. Revogar lista ou convite pendente **não** suspende uma conta já criada. Suspensão de conta é operação separada.

O login administrativo precisa de autenticação real com sessão segura e papel de plataforma separado de `memberships.role`. Nenhuma pessoa recebe permissão de plataforma por ser responsável por uma casa. Uma identidade admin que também tenha papel residencial acessa conteúdo doméstico somente pela própria sessão residencial e pelos vínculos explícitos. Autorizar leitura e escrita no servidor, negar por padrão, auditar mudanças e evitar retornar dados sensíveis no payload.

## Operações esperadas pelo `AdminGateway`

O tipo TypeScript em `apps/web/src/admin/contracts.ts` é o contrato de apresentação; `apps/web/src/admin/httpGateway.ts` mapeia as operações para as rotas reais. O gateway deve preservar semântica e estados de erro:

| Método e rota | Entrada | Saída / regra |
| --- | --- | --- |
| `POST /api/admin/session` | e-mail, senha e TOTP | sessão administrativa; cookie seguro no backend |
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
| Exportar CSV | Gerado no cliente a partir de `GET /api/admin/analytics` | Contém apenas os agregados já retornados pela API. |

Erros estruturados: `{ code, message, request_id }`. Códigos mínimos: `unauthenticated` (401), `forbidden` (403), `not_found` (404), `duplicate_email` (409), `sole_owner` (409), `invalid_state` (409), `validation` (422), `rate_limited` (429). Não diferenciar publicamente e-mail existente de inexistente em fluxos de cadastro e convite. Listagens devem impor tamanho de página máximo, filtros validados e ordenação determinística. Para atomicidade, auditoria e idempotência, seguir o contrato de backend/deploy.

## Eventos e métricas

Eventos atuais: `conta_criada`, `acesso`, `entrada_casa`, `tarefa_criada`, `tarefa_concluida`, `tarefa_pulada` e `tarefa_editada`. Associar `occurred_at`, `user_id?`, `household_id?` e ID único; não guardar conteúdo de tarefa/lista em eventos. Mudanças administrativas usam `admin_audit_events`, separado da atividade de produto.

Todas as métricas usam intervalo UTC fechado no fim e origem/tamanho selecionados. O frontend exibe intervalo e denominadores. O backend deve retornar agregados, não linhas brutas:

- **Funil de acesso por pessoa:** e-mails únicos que receberam autorização ou convite no período, inclusive se o acesso depois expirou ou foi revogado → contas criadas a partir dessas concessões no período → pessoas desse grupo que entraram em uma casa. Relacionar conta e concessão por ID imutável, nunca pelo e-mail editável. A taxa de cada etapa usa a anterior. Para segmentar por tamanho da casa, pessoas que ainda não entraram em casa não têm tamanho conhecido; a interface da demo as exclui desse filtro. O backend pode optar por uma dimensão explícita `unknown` e deve documentá-la.
- **Funil de ativação por casa:** casas criadas no período com pelo menos sete dias completos de observação → duas pessoas vinculadas em até sete dias da criação → primeira tarefa criada nesse prazo → primeira conclusão nesse prazo. Cada taxa usa a etapa anterior. Contar casas distintas, não eventos.
- **Casa ativa:** ao menos uma criação ou conclusão de tarefa na semana. Série semanal inclui no denominador casas existentes no fim da semana do segmento. A última semana pode ser parcial.
- **Retenção:** casas criadas no período selecionado, agrupadas pela semana de criação. Semana 1 corresponde aos dias 7–13 após criação; semana 4 aos dias 28–34. Denominador de cada célula inclui apenas casas que completaram 14 ou 35 dias, respectivamente. Mostrar `—` quando ainda não houve tempo suficiente. Para comparar semana 1 e 4, usar **o mesmo conjunto** de casas maduras de 35 dias. Assim, o filtro de 90 dias é necessário para visualizar semana 4.
- **Acúmulo:** tarefas sem `completed_at` e `due_at` anterior ao instante da consulta, com denominador de todas as tarefas abertas nas casas do segmento. Nenhum título de tarefa é necessário.
- **Insights:** maior queda absoluta entre etapas, diferença descritiva de retenção no mesmo grupo e proporção de vencidas em aberto. Se menos de dez casas maduras no funil, sinalizar amostra pequena e evitar conclusões fortes. Sinais de precificação são hipóteses de uso por tamanho, sem estimar receita ou disposição a pagar.

O CSV do cliente contém somente os agregados recebidos. A API não oferece uma rota CSV separada.

## Estados da interface e limites atuais

`AdminGateway` é assíncrono; a interface trata carregamento, vazio, erro e sucesso. TanStack Query invalida consultas relacionadas após mutações. O gateway demo mantém alterações em memória e não envia e-mail; o build de produção conecta ao backend e não inclui fixtures nem credenciais demo. O cadastro continua restrito por `/acesso` e pelas autorizações verificadas no servidor.
