# Chega de Briga

PWA para organizar tarefas recorrentes e compras compartilhadas de uma casa. O repositório contém a interface React, a API Fastify, o contrato de dados administrativo e o design system.

## Desenvolvimento local

Requer Node.js 24, pnpm 12.6.0 e Docker Compose para o fluxo integrado.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` sobe um PostgreSQL local isolado, aplica as migrações e inicia a API e o Vite com `/api` encaminhado para a API. A interface fica em `http://127.0.0.1:5173`, o cadastro público permanece fechado e nenhuma mensagem é enviada. Use contatos sintéticos terminados em `.test`. Se as portas padrão estiverem ocupadas, escolha portas livres, por exemplo `CDB_WEB_PORT=5177 CDB_API_PORT=3001 pnpm dev`. A API de desenvolvimento escuta somente em `127.0.0.1`. Para abrir somente a interface com gateways de demonstração, sem banco ou API, rode `pnpm dev:demo`.

Para executar a API manualmente, configure as variáveis documentadas em [`docs/backend-deployment-contract-v1.md`](./docs/backend-deployment-contract-v1.md), disponibilize PostgreSQL e rode:

```bash
pnpm api:dev
```

Para parar o banco local, rode `docker compose -f docker-compose.local.yml down`; o volume de desenvolvimento é preservado.

As rotas `/admin` e `/entrar` usam o backend local em `pnpm dev` e serviços reais no build de produção. Só `pnpm dev:demo` usa gateways simulados e mostra avisos de demonstração; ele não inicia banco nem API. Não use credenciais demo nem fixtures para validar produção.

## Build e execução

```bash
pnpm build
pnpm preview
```

O build gera a PWA do app em `apps/web/dist` e a API em `apps/api/dist`. O [`Dockerfile`](./Dockerfile) constrói o serviço do app, aplica as migrações PostgreSQL e inicia a API. A landing estática é gerada à parte por `pnpm build:landing`, em `apps/web/dist-landing`; esse build não inclui autenticação, console, service worker ou manual visual. `pnpm preview` serve somente a interface do Vite; não substitui a execução completa do serviço.

Em produção, `chegadebriga.forjacorp.com` serve somente a landing e `app.chegadebriga.forjacorp.com` serve a PWA e API. A landing chama apenas as rotas públicas permitidas na configuração `PUBLIC_LANDING_ORIGINS`; o app mantém API same-origin.

### Landing e guias

`pnpm build:landing` gera HTML completo para a landing e os dois guias, além de `404.html`, `robots.txt` e sitemap. O navegador hidrata o HTML e consulta a disponibilidade de cadastro em runtime; o build não chama a API. Por padrão, o resultado é `noindex` e o sitemap fica vazio. Para produção:

```bash
LANDING_INDEXABLE=true VITE_APP_ORIGIN=https://app.chegadebriga.forjacorp.com pnpm build:landing
pnpm check:landing
pnpm preview:landing
```

O preview estático escuta em `http://127.0.0.1:4174`, serve os guias por URL direta e responde `404` para caminhos desconhecidos. Use `LANDING_PREVIEW_PORT` para outra porta. Para testar o formulário localmente, gere a landing com `VITE_APP_ORIGIN` apontando para sua API de desenvolvimento e permita a origem do preview em `PUBLIC_LANDING_ORIGINS`. Nunca use contatos reais nos testes.

Os textos e metadados dos guias ficam em `apps/web/src/landing/`; atualize a data editorial somente quando revisar o conteúdo. URLs canônicas e sitemap usam o domínio público, sem UTMs. A configuração do Nginx e a ordem de publicação estão no [contrato de deploy](./docs/backend-deployment-contract-v1.md#publicação-da-landing-e-descoberta).

### Verificações

```bash
pnpm --filter @chega-de-briga/domain build
pnpm check
pnpm --filter @chega-de-briga/api test
pnpm build:landing
pnpm check:landing
```

Para a integração de aquisição, configure `TEST_DATABASE_URL` para um PostgreSQL **local e descartável** e rode `pnpm --filter @chega-de-briga/api test:integration`. O teste cria e remove seu próprio schema, aplica migrações com um evento antigo, inicia uma API local sem e-mail/push e verifica validação, deduplicação e agregação. Ele é ignorado quando a variável não está definida. Não aponte esse teste para produção.

## Fontes do projeto

- [`docs/modelagem-mobile-v1.md`](./docs/modelagem-mobile-v1.md): fluxos e regras de produto residencial.
- [`docs/admin-backend-contract.md`](./docs/admin-backend-contract.md): dados e operações do console administrativo.
- [`docs/backend-deployment-contract-v1.md`](./docs/backend-deployment-contract-v1.md): autenticação, persistência, privacidade operacional, variáveis e deploy.
- [`design-system/README.md`](./design-system/README.md) e [`design-system/componentes.md`](./design-system/componentes.md): regras visuais e escolha de componentes.
- A rota `/componentes` mostra a galeria interativa da biblioteca somente no desenvolvimento.

O manual de marca em `design-system/index.html` também pode ser aberto diretamente, sem build.

## Licença

O código original do app e a documentação técnica estão sob GNU AGPL-3.0-only. O nome, os logos e as artes da identidade visual estão reservados e não são licenciados junto com o código. As fontes mantêm suas licenças SIL OFL. Consulte [`LICENSING.md`](./LICENSING.md) para o escopo completo.
