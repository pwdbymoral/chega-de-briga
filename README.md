# Chega de Briga

PWA para organizar tarefas recorrentes e compras compartilhadas de uma casa. O repositório contém a interface React, a API Fastify, o contrato de dados administrativo e o design system.

## Desenvolvimento local

Requer Node.js 24 e pnpm 12.6.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` abre o protótipo local com gateways de demonstração. Ele não exige banco e não envia e-mails. Para executar a API, configure as variáveis documentadas em [`docs/backend-deployment-contract-v1.md`](./docs/backend-deployment-contract-v1.md), disponibilize PostgreSQL e rode:

```bash
pnpm api:dev
```

As rotas `/admin` e `/entrar` usam dados simulados em desenvolvimento e serviços reais no build de produção. Não use credenciais demo nem fixtures para validar produção.

## Build e execução

```bash
pnpm build
pnpm preview
```

O build gera a PWA em `apps/web/dist` e a API em `apps/api/dist`. O [`Dockerfile`](./Dockerfile) constrói o serviço único, aplica as migrações PostgreSQL e inicia a API que serve a PWA e os endpoints `/api`. `pnpm preview` serve somente a interface do Vite; não substitui a execução completa do serviço.

## Fontes do projeto

- [`docs/modelagem-mobile-v1.md`](./docs/modelagem-mobile-v1.md): fluxos e regras de produto residencial.
- [`docs/admin-backend-contract.md`](./docs/admin-backend-contract.md): dados e operações do console administrativo.
- [`docs/backend-deployment-contract-v1.md`](./docs/backend-deployment-contract-v1.md): autenticação, persistência, privacidade operacional, variáveis e deploy.
- [`design-system/README.md`](./design-system/README.md) e [`design-system/componentes.md`](./design-system/componentes.md): regras visuais e escolha de componentes.
- A rota `/componentes` na PWA mostra a galeria interativa da biblioteca.

O manual de marca em `design-system/index.html` também pode ser aberto diretamente, sem build.

## Licença

O código original do app e a documentação técnica estão sob GNU AGPL-3.0-only. O nome, os logos e as artes da identidade visual estão reservados e não são licenciados junto com o código. As fontes mantêm suas licenças SIL OFL. Consulte [`LICENSING.md`](./LICENSING.md) para o escopo completo.
