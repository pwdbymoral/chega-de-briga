# Chega de Briga

Base de frontend da PWA para organizar combinados entre pessoas que dividem uma casa. Inclui identidade visual, galeria de componentes, demo do console administrativo e protótipo interativo de autenticação para moradores. Ainda não há backend nem fluxos de tarefas.

## Começar

Requer Node.js 24 e pnpm 12.6.0. Na raiz do repositório:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Abra o endereço mostrado pelo Vite. A rota `/componentes` reúne os controles reutilizáveis. `/acesso` informa que o cadastro público está fechado. Em desenvolvimento, `/admin` abre o console demo; em `/admin/acessos`, crie uma autorização ou convite e use **Testar** para abrir o cadastro. Também é possível entrar, recuperar senha, redefinir pelo link de teste e criar uma casa. Nenhum e-mail é enviado; os dados e senhas ficam somente em memória e se perdem ao recarregar. O [manual de marca](./design-system/index.html) continua sendo um site estático: pode ser aberto diretamente no navegador, sem build.

```bash
pnpm check      # tokens, tipos, interações e testes
pnpm build      # gera a PWA em apps/web/dist
pnpm preview    # serve o build localmente
```

## Organização

- `apps/web`: React, TypeScript, Vite e PWA. A interface usa CSS Modules e os tokens semânticos.
- `design-system`: fonte das regras visuais e de escolha de componentes; consulte o [guia do design system](./design-system/README.md).
- `docs/modelagem-mobile-v1.md`: modelo de navegação, wireframes e regras de produto para o app residencial PWA.
- `apps/mobile`: reservado para um futuro app Expo/React Native. Ele poderá importar `@chega-de-briga/design-system/tokens.native` e os arquivos de marca; componentes de interface serão próprios da plataforma.
- `apps/web/src/admin`: contratos `AdminGateway` e `AuthGateway`, adaptadores demo em memória com dados compartilhados, métricas agregadas e telas do console. O [contrato para o futuro backend](./docs/admin-backend-contract.md) é a referência para dados, segurança, operações e métricas da integração administrativa.

## Interface

As regras visuais estão em [`design-system/README.md`](./design-system/README.md); decisões de uso e limites ficam em [`design-system/componentes.md`](./design-system/componentes.md). As APIs dos componentes vivem no código em `apps/web/src/components`; `/componentes` é uma galeria interativa de exemplos.

## Publicação da PWA

Sirva `apps/web/dist` na raiz da origem, com HTTPS. A hospedagem deve encaminhar rotas como `/componentes` e `/acesso` para `index.html`. O primeiro acesso precisa de conexão; depois, o shell e seus arquivos essenciais ficam disponíveis offline. O service worker é gerado somente no build de produção. O manifest usa os PNGs existentes, inclusive maskable e Apple touch icon. O console, as simulações de autenticação, credenciais e fixtures da demo não entram no build público. `/acesso` continua fechado até existir backend para autenticação, autorização e envio de e-mails reais.
