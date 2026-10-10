# Contrato para o futuro backend administrativo

Este documento descreve o modelo de dados e as operações que a interface em `apps/web/src/admin` espera. O console atual é **apenas uma demonstração local em desenvolvimento**. A checagem de permissão feita no navegador não protege dados. Antes de habilitar estas rotas em produção, o servidor terá de autenticar a pessoa administradora e autorizar **cada** leitura e mutação. O build público atual não contém o console.

## Entidades e relações

| Entidade | Campos essenciais | Chaves e restrições |
| --- | --- | --- |
| `users` | `id`, `email_normalized`, `name`, `status`, `access_grant_id`, `created_at`, `last_seen_at` | `id` imutável; e-mail normalizado único entre contas não excluídas; FK para concessão de acesso; estado `active`, `suspended`, `deleted` |
| `households` | `id`, `name`, `created_at` | `id` imutável |
| `memberships` | `user_id`, `household_id`, `role`, `joined_at` | FK para as duas entidades; par `(user_id, household_id)` único; papel `owner` ou `member`; casa com pelo menos um owner ativo |
| `access_grants` | `id`, `email_normalized`, `source`, `created_at` | concessão histórica imutável; origem `allowlist`, `admin_invite` ou `resident_invite`; `users.access_grant_id` preserva o vínculo mesmo após edição do e-mail |
| `allow_entries` | `id`, `access_grant_id`, `revoked_at`, `created_by` | FK única para concessão; uma autorização ativa por e-mail; revogação não altera conta já criada |
| `invitations` | `id`, `access_grant_id`, `household_id`, `inviter_user_id`, `status`, `expires_at`, `accepted_at`, `revoked_at` | FK única para concessão; convite de morador exige casa e convidador membro ativo; expiração após 7 dias; token secreto armazenado **somente como hash**, nunca no payload administrativo |
| `task_metadata` | `id`, `household_id`, `created_at`, `due_at`, `completed_at` | somente os campos necessários para métricas; títulos, descrições, comentários e anexos pertencem ao domínio privado de tarefas e não entram nas respostas do console |
| `activity_events` | `id`, `event_type`, `user_id?`, `household_id?`, `occurred_at` | eventos append-only com idempotência por ID; tipos abaixo |
| `admin_audit_events` | `id`, `actor_admin_id`, `action`, `target_type`, `target_id`, `occurred_at`, `request_id` | append-only; nunca incluir senha, token ou conteúdo doméstico |

IDs são opacos, estáveis e não devem codificar e-mail. Timestamps são ISO 8601 UTC. E-mails são normalizados no servidor antes de verificar unicidade; o endereço original pode ser preservado para exibição se necessário. Deleção real e prazo de retenção exigem política de privacidade própria; a demo apenas anonimiza o perfil em memória.

## Entrada restrita

O cadastro público começa fechado. Há dois caminhos de elegibilidade:

1. Um e-mail ativo na lista de autorização permite criar conta.
2. Um convite válido, não aceito e não revogado permite criar conta. Convite de morador vinculado a uma casa também cria o vínculo naquela casa, sem aprovação manual. A aceitação do convite e a criação do vínculo devem ocorrer na mesma transação.

O servidor deve validar token, e-mail, expiração e estado em cada aceitação, limitar tentativas e consumo duplicado, e registrar quem convidou. Pode haver convites válidos para casas diferentes; impedir duplicação de convite pendente para o mesmo par e-mail/casa. Convites de moradores só podem ser criados por um membro ativo da própria casa; administradores podem criar convites gerais ou vinculados. Reenvio revoga o token anterior e cria outro com nova validade de sete dias. Revogar lista ou convite pendente **não** suspende uma conta já criada. Suspensão de conta é operação separada.

O login administrativo precisa de autenticação real com sessão segura e papel de plataforma separado de `memberships.role`. Nenhuma pessoa recebe permissão de plataforma por ser responsável por uma casa. Autorizar leitura e escrita no servidor, negar por padrão, auditar mudanças e evitar retornar dados sensíveis no payload.

## Operações esperadas pelo `AdminGateway`

O tipo TypeScript em `apps/web/src/admin/contracts.ts` é o contrato de apresentação. O futuro adaptador HTTP deve preservar semântica e estados de erro. Sugestão de endpoints:

| Método e rota | Entrada | Saída / regra |
| --- | --- | --- |
| `POST /admin/session` | e-mail, senha | sessão administrativa; cookie seguro no backend |
| `GET /admin/session`, `DELETE /admin/session` | — | estado da sessão / encerramento |
| `GET /admin/users` | `search`, `status`, `page`, `page_size` | `items`, `total`, `page`, `pages`; ordenação estável; busca por nome/e-mail |
| `GET /admin/users/:id` | ID | perfil, vínculos, metadados de atividade e auditoria pertinente; sem conteúdo de tarefas |
| `PATCH /admin/users/:id` | nome, e-mail | perfil atualizado; checar unicidade |
| `PATCH /admin/users/:id/status` | `active` ou `suspended` | estado atualizado; não deixar casa sem responsável ativo |
| `DELETE /admin/users/:id` | confirmação | exclusão conforme política de privacidade; não deixar casa sem responsável ativo |
| `PATCH /admin/households/:id/members/:userId` | `role` | vínculo atualizado; transação protege último responsável |
| `GET /admin/access` | paginação e filtros futuros | lista de autorizações e convites, inclusive convites de moradores |
| `POST /admin/allow-entries`, `DELETE /admin/allow-entries/:id` | e-mail / ID | criar ou revogar autorização |
| `POST /admin/invitations`, `POST /admin/invitations/:id/resend`, `DELETE /admin/invitations/:id` | e-mail, casa opcional / ID | criar, reenviar ou revogar; envio de e-mail fora da transação por fila com idempotência |
| `GET /admin/households`, `GET /admin/households/:id` | filtros e paginação futuros / ID | casa, membros, contagens e eventos permitidos; sem títulos, descrições ou anexos |
| `GET /admin/analytics` | `period=7|30|90`, `source`, `size` | agregados, denominadores, intervalo, coortes, série e insights explicáveis |
| `GET /admin/analytics.csv` | mesmos filtros | CSV agregado, sem identificadores pessoais |

Erros estruturados: `{ code, message, request_id }`. Códigos mínimos: `unauthenticated` (401), `forbidden` (403), `not_found` (404), `duplicate_email` (409), `sole_owner` (409), `invalid_state` (409), `validation` (422), `rate_limited` (429). Não diferenciar publicamente e-mail existente de inexistente em fluxos de cadastro e convite. Listagens devem impor tamanho de página máximo, filtros validados e ordenação determinística. Mutação e auditoria devem compartilhar transação. IDs de requisição e chaves de idempotência protegem reenvio, convite e aceitação contra repetição.

## Eventos e métricas

Eventos mínimos: `account_created`, `access`, `household_joined`, `task_created`, `task_completed`. Associar `occurred_at`, `user_id?`, `household_id?`, `source` quando aplicável e ID único. Registrar mudança de papel, suspensão, reativação, exclusão e revogações na auditoria, separada da atividade de produto. Eventos devem ser emitidos de transações concluídas, sem payload de conteúdo doméstico.

Todas as métricas usam intervalo UTC fechado no fim e origem/tamanho selecionados. O frontend exibe intervalo e denominadores. O backend deve retornar agregados, não linhas brutas:

- **Funil de acesso por pessoa:** e-mails únicos que receberam autorização ou convite no período, inclusive se o acesso depois expirou ou foi revogado → contas criadas a partir dessas concessões no período → pessoas desse grupo que entraram em uma casa. Relacionar conta e concessão por ID imutável, nunca pelo e-mail editável. A taxa de cada etapa usa a anterior. Para segmentar por tamanho da casa, pessoas que ainda não entraram em casa não têm tamanho conhecido; a interface da demo as exclui desse filtro. O backend pode optar por uma dimensão explícita `unknown` e deve documentá-la.
- **Funil de ativação por casa:** casas criadas no período com pelo menos sete dias completos de observação → duas pessoas vinculadas em até sete dias da criação → primeira tarefa criada nesse prazo → primeira conclusão nesse prazo. Cada taxa usa a etapa anterior. Contar casas distintas, não eventos.
- **Casa ativa:** ao menos uma criação ou conclusão de tarefa na semana. Série semanal inclui no denominador casas existentes no fim da semana do segmento. A última semana pode ser parcial.
- **Retenção:** casas criadas no período selecionado, agrupadas pela semana de criação. Semana 1 corresponde aos dias 7–13 após criação; semana 4 aos dias 28–34. Denominador de cada célula inclui apenas casas que completaram 14 ou 35 dias, respectivamente. Mostrar `—` quando ainda não houve tempo suficiente. Para comparar semana 1 e 4, usar **o mesmo conjunto** de casas maduras de 35 dias. Assim, o filtro de 90 dias é necessário para visualizar semana 4.
- **Acúmulo:** tarefas sem `completed_at` e `due_at` anterior ao instante da consulta, com denominador de todas as tarefas abertas nas casas do segmento. Nenhum título de tarefa é necessário.
- **Insights:** maior queda absoluta entre etapas, diferença descritiva de retenção no mesmo grupo e proporção de vencidas em aberto. Se menos de dez casas maduras no funil, sinalizar amostra pequena e evitar conclusões fortes. Sinais de precificação são hipóteses de uso por tamanho, sem estimar receita ou disposição a pagar.

O CSV deve conter apenas linhas agregadas de funil, casas ativas, coortes e tarefas em aberto. Aplicar supressão ou agrupamento de células pequenas na produção se combinações de filtros puderem reidentificar uma casa. Definir prazo de retenção de eventos e base legal/finalidade antes de coletar dados reais; evitar analytics de conteúdo doméstico.

## Estados da interface e limites atuais

`AdminGateway` é assíncrono; a interface trata carregamento, vazio, erro e sucesso. TanStack Query invalida consultas relacionadas após mutações. O adaptador de demonstração mantém alterações só em memória; recarregar a página restaura as fixtures, enquanto a flag de sessão de demonstração dura a aba. Nenhum e-mail é enviado. O build de produção serve `/acesso` com cadastro fechado e exclui o módulo administrativo. Antes da publicação do console, substituir o gateway, implantar autorização no servidor e revisar acessibilidade, segurança e privacidade com dados reais.
