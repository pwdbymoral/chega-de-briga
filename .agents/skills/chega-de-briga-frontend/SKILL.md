---
name: chega-de-briga-frontend
description: Aplique as regras de interface do Chega de Briga ao criar ou alterar telas, componentes, interações, estilos ou apresentação da PWA.
---

# Interface web

- Para regras visuais e tokens, leia apenas as seções relevantes de [`design-system/README.md`](../../../design-system/README.md).
- Para escolher controle ou padrão de interação, localize a intenção em [`design-system/componentes.md`](../../../design-system/componentes.md) e leia só a seção pertinente.
- Confirme API, props e chamadores no código. `/componentes` é uma galeria interativa, não a especificação da API.
- Ao adicionar ou revisar um rótulo acima de título (`.eyebrow`), um label em caixa alta ou qualquer elemento decorativo repetido em várias seções, aplique o critério em [`design-system/componentes.md`](../../../design-system/componentes.md#rótulo-acima-de-título-eyebrow): mantenha só o que carrega informação que o título não dá; corte o que só parafraseia ou enfeita.
- Ao adicionar ou alterar um componente compartilhado, atualize o guia de componentes somente se mudar a decisão de uso ou um limite; não copie props, catálogo completo ou exemplos de código.
- Antes de avaliar uma tela, espere a aplicação carregar e confirme que está vendo o app, não um asset isolado. Confira estado, largura, tema e rolagem renderizados.
- Em mudanças visuais, confira 320, 390, 768 e 1440 px nos temas claro e escuro, além de foco e teclado nos controles alterados. Confira zoom real quando disponível e relate somente o que observou.
