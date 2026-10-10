# Chega de Briga — identidade e design system

Abra [o manual visual](./index.html) no navegador. Ele contém as regras de marca, exemplos de interface, temas, copy e links para baixar cada logo. Os arquivos são estáticos e não precisam de instalação.

## Fontes de verdade

- [`tokens/source.json`](./tokens/source.json): fonte canônica das cores, escala tipográfica fixa, espaçamento, formas e movimento. `pnpm tokens:build` gera [`generated/tokens.css`](./generated/tokens.css) e [`generated/tokens.native.ts`](./generated/tokens.native.ts).
- [`tokens.css`](./tokens.css): entrada web que importa os tokens gerados e acrescenta fontes locais, tipografia fluida e movimento reduzido. A interface deve usar `--color-*`; `--brand-*` identifica as cores fixas da marca.
- [`componentes.md`](./componentes.md): decisões de uso, limites dos componentes web e padrões de interface. As APIs e props continuam definidas pelo código em `apps/web/src/components`.
- [`assets/logo-editavel.svg`](./assets/logo-editavel.svg): assinatura principal com texto editável. Os demais logos têm letras convertidas em vetor e podem ser usados sem instalar fontes.
- [`assets/`](./assets/): logos, símbolos, elementos gráficos, ícones e PNGs para a futura PWA.
- [`fonts/`](./fonts/): Inter e Comfortaa locais, com as respectivas licenças SIL OFL.

## Convenções para implementar a interface

1. Importe `tokens.css` antes dos estilos dos componentes. Defina `data-theme="light"` ou `data-theme="dark"` no elemento `<html>`; se não houver escolha salva, use `prefers-color-scheme` para escolher o tema inicial.
2. Use os papéis semânticos para superfícies, texto, estados e ações. Não copie os valores hexadecimais do manual para novos componentes.
3. Mantenha áreas de toque com pelo menos 48 px, foco visível e rótulos legíveis. Estado nunca depende só da cor ou de um ícone. Em barras fixas da PWA, considere `env(safe-area-inset-bottom)`.
4. Reserve a animação expressiva para momentos especiais. Os tokens de movimento respeitam `prefers-reduced-motion`.
5. Escreva em português do Brasil: direto, cúmplice e irreverente. Humor sobre a bagunça; informação e próximo passo primeiro em erros e atrasos. Não exponha nem culpe moradores.
6. Preserve proporção e área livre dos logos. Em espaços muito pequenos, use `simbolo.svg`.
7. Para ícones funcionais sobre superfícies escuras, use os arquivos `icone-*-escuro.svg`; os arquivos sem sufixo são para fundos claros. Um SVG externo em `<img>` não herda `currentColor` do elemento pai.
8. Use SVG para ícones e elementos gráficos; não use emoji como substituto. No app web, ícones utilitários usam Lucide React.
9. No celular, empilhe ações com rótulos longos em larguras iguais. Pares curtos de navegação podem dividir a linha em duas colunas iguais. A ação secundária mantém menor peso visual.

## Animação de abertura

O splash usa `assets/splash-animado.svg`, com os caminhos do `simbolo.svg` entrando em sequência e a faísca aparecendo no final. O SVG é vetorial, reproduzido pelo navegador sem runtime extra e já incluído no cache offline pela regra de arquivos `*.svg` da PWA. Com movimento reduzido, a abertura do app é pulada; se houver espera do console, usa-se `assets/simbolo.svg` estático. A tela inicial do sistema operacional continua estática; esta animação só começa quando a interface pode ser renderizada. No navegador, aparece uma vez por carregamento completo do app, sem repetir ao navegar entre rotas.

`ConsoleLoading` reaproveita o mesmo splash como fallback de carregamento das telas de demonstração de autenticação e console. O SVG SMIL é específico da web; ao começar o app Expo, exportar a mesma composição como `.lottie` no [Lottie Creator](https://docs.lottiefiles.com/en/creator) para compartilhar a animação com [`@lottiefiles/dotlottie-react-native`](https://docs.lottiefiles.com/en/runtimes/distributions/react-native/v0.x). Para uma versão Lottie da PWA, o player escolhido é [`@lottiefiles/dotlottie-react`](https://docs.lottiefiles.com/en/runtimes/distributions/react).

## Arquivos para instalação futura

| Uso | Arquivo |
| --- | --- |
| Ícone comum 192 px | `assets/pwa-192.png` |
| Ícone comum 512 px | `assets/pwa-512.png` |
| Ícone maskable Android | `assets/pwa-maskable-192.png` e `assets/pwa-maskable-512.png` |
| Tela inicial iOS | `assets/apple-touch-icon.png` (fonte: `assets/apple-touch-icon.svg`) |
| Favicon | `assets/favicon-16.png`, `assets/favicon-32.png` ou `assets/simbolo.svg` |

Os PNGs maskable e o Apple touch icon usam fundo azul opaco até a borda; o sistema aplica o corte necessário. Os maskable mantêm o desenho essencial dentro da área circular segura. O manifest e a integração estão em `apps/web`.

## Verificação das interações

Execute `node design-system/check-interactions.mjs` na raiz do projeto. O script executa o JavaScript real do manual em um DOM simulado e confere alternância de tema, preferência salva e estados textuais dos cartões. Ele não substitui uma conferência visual e de acessibilidade em navegadores e dispositivos reais.
