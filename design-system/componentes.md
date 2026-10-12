# Escolha de componentes e padrões de interface

Este documento define qual solução usar para cada intenção e quando ela não serve. Ele não replica a API: implementação, comportamento e props são definidos em [`apps/web/src/components`](../apps/web/src/components/) e nos chamadores. A rota `/componentes` mostra exemplos interativos; não é a especificação da API.

## Componente ou padrão?

Um componente é uma peça reutilizável com comportamento e API próprios. Um padrão resolve uma necessidade recorrente combinando componentes. Prefira compor peças existentes para uma necessidade isolada. Extraia uma nova peça compartilhada quando uma interação se repetir ou quando o comportamento e a acessibilidade precisarem ser iguais em várias telas. Aparência parecida, sozinha, não exige um componente.

## Entradas e escolhas

| Necessidade | Use | Não use quando |
| --- | --- | --- |
| Informar texto ou um valor de entrada simples | `TextField`, com rótulo visível; `hint` ou `error` quando necessário. O tipo nativo do input define formatos como texto ou senha. Ao avaliar o alvo clicável, confira o input e o rótulo associado. | A pessoa precisa escolher uma data ou optar entre alternativas fechadas. |
| Escolher uma data no calendário da casa | `DatePicker`, com rótulo visível, navegação por mês, seleção de dia e atalhos rápidos contextuais. | A data for um ano ou mês isolado, ou quando uma entrada de texto livre for suficiente. |
| Escolher um único valor de uma lista | `Select` com variante `field` em formulários ou `compact` quando o controle precisa ocupar menos espaço. As variantes usam a mesma lista. Na variante compacta, o contexto ao redor deve deixar a finalidade e o valor selecionado claros; não deixe uma seta isolada ser a única pista visível. | A ação navega ou executa um comando. Não use para múltipla escolha nem para listas extensas que exigem busca; o componente não oferece busca. Para poucas opções exclusivas visíveis, prefira um grupo de `<input type="radio">`; para várias escolhas independentes, use checkboxes. |
| Marcar ou desmarcar uma condição independente | `Checkbox`, para uma opção que pode coexistir com outras. | A escolha é exclusiva; use radios ou `Select`. Para concluir uma tarefa, use um botão com rótulo. |

## Ações e navegação

| Necessidade | Use | Não use quando |
| --- | --- | --- |
| Executar uma ação ou mudar estado | `Button`. Use `primary` para a ação principal do grupo, `secondary` para apoio e `quiet` para baixa ênfase. A variante altera o peso visual, não a semântica. | O destino é uma página ou rota. Use um link para navegação; não promova todas as ações a `primary`. |
| Navegar para uma rota como ação principal da página | `LinkButton`, preservando a semântica de link e usando a mesma aparência de `Button` `primary`. Para navegação comum, use um link de texto. | A ação não navega; use `Button`. Não crie estilos locais para fazer um link parecer botão. |
| Reunir duas ou mais ações secundárias do mesmo item | Quando o item tiver duas ou mais ações secundárias, reúna-as em um disclosure contextual com o rótulo visível “Ações”; em telas estreitas, o gatilho pode mostrar apenas o ícone de reticências se mantiver esse nome acessível. Mostre as opções em lista vertical com nomes textuais. Deixe qualquer ação principal fora do grupo e mantenha ações destrutivas por último, com confirmação. | O item tiver apenas uma ação secundária: deixe-a visível na linha. A ação principal fica sempre fora do disclosure. |
| Concluir uma tarefa | `Button` `primary` com rótulo “Concluir”. Depois da conclusão, ofereça `Desfazer` em um Toast quando a reversão for segura. | `Checkbox` ou `IconButton` quando há espaço para um botão principal com texto. |
| Executar uma ação apenas com ícone | `IconButton` compartilhado quando o espaço realmente não comportar texto e o ícone/contexto tornarem a ação evidente. Forneça nome acessível e dica visual; esses recursos não substituem o rótulo visível quando o significado não for imediato. | A ação cabe com rótulo ou exige interpretação. Nesse caso, mostre o texto e mantenha ações secundárias com menor ênfase que a principal do contexto. Para navegar, use um link com rótulo visível. |
| Navegar pelas rotas públicas ou administrativas em telas estreitas | `MobileMenu` no shell React com React Router. No console administrativo, use sidebar persistente em telas largas e `MobileMenu` em telas estreitas; mantenha ações e busca da tela à vista. | A área residencial tem três destinos principais e usa uma barra inferior persistente; não replique o menu do site ali. Para seções da mesma página, use links em `<nav>`; o manual estático segue esse padrão. |
| Fazer uma escolha curta e contextual, voltando ao mesmo ponto | `BottomSheet` com `<dialog>` nativo, como escolher uma casa ou o escopo de uma edição. | Não use como navegação principal nem para formulários longos; use uma tela própria. `MobileMenu` é um menu de rotas diferente. |
| Confirmar uma ação importante e difícil de reverter | `ConfirmDialog`. Explique o efeito e nomeie a ação no botão de confirmação. | Ações comuns e reversíveis, como concluir, pular, pausar ou marcar compra: execute diretamente e ofereça **Desfazer** com Toast quando a reversão for segura. |

## Conteúdo, estado e ajuda

| Necessidade | Use | Não use quando |
| --- | --- | --- |
| Agrupar conteúdo independente | `Card` quando a semântica de `<article>` representa uma peça autônoma. | Só precisa de espaçamento ou de um contêiner de layout; use a estrutura semântica adequada ao contexto. |
| Mostrar a identidade de uma pessoa | `Avatar`, com nome acessível. | Precisa indicar estado, permissão ou ação. |
| Mostrar papel ou permissão | Texto neutro e explícito junto à pessoa ou à casa. Papel descreve autorização, não estado. | `StatusBadge`, cuja cor sugere a condição de algo. |
| Mostrar um estado não interativo | `StatusBadge`, sempre com texto: `success` para concluído ou ativo; `warning` para pendente ou pausado; `danger` para atrasado, suspenso ou bloqueado. | A pessoa precisa alterar o estado; use um controle de ação. |
| Confirmar uma ação concluída e oferecer uma reversão breve | Toast global com mensagem curta e ação opcional, como **Desfazer**. Use para sucesso transitório; no app, o status é anunciado sem mover o foco. Toast é feedback dentro da página, não notificação do sistema; posicione-o acima de navegação fixa. | Erro que impede continuar, conflito de sincronização ou informação que precisa permanecer visível. Mostre esses estados no conteúdo da tela; use confirmação para ação destrutiva. |
| Explicar que uma coleção não tem itens | `EmptyState`, com título e explicação. | O conteúdo está carregando ou houve falha; esses estados precisam de mensagem e ação próprias. |
| Dar uma dica breve e complementar | `TooltipLayer`, usando `data-tooltip`. Ele já é montado globalmente em `apps/web/src/main.tsx`; o conteúdo da dica é visual e não substitui rótulo ou instrução acessível. | A informação é necessária para concluir a tarefa; deixe-a visível junto ao controle. Se a dica for cortada, verifique `overflow` e o contexto de empilhamento dos ancestrais; elevar `z-index` sozinho não remove recorte. |
| Indicar abertura do app ou carregamento de uma tela de demonstração | `SplashScreen` na abertura inicial; `ConsoleLoading` como fallback de telas de autenticação e console carregadas sob demanda. Para alterar a abertura, consulte [Animação de abertura](./README.md#animação-de-abertura). | A espera é local a uma ação ou a uma parte da página; prefira feedback junto a essa ação ou conteúdo. |

## Listas e rolagem

- Preserve nomes legíveis quando ações disputarem espaço; confira o arranjo compacto antes de aumentar a altura de todas as linhas.
- Evite rolagem vertical dentro de outra rolagem para conteúdo de leitura normal. Confira a rolagem renderizada, não apenas regras de `overflow` no CSS.
- Quando uma tabela não couber na tela, mantenha a tabela semântica dentro de um contêiner de rolagem horizontal focalizável e nomeado; impeça que a página inteira ganhe largura extra.
- Escolha busca, expansão ou paginação pela quantidade de itens e pela facilidade de encontrar um item; não pagine apenas para uniformizar telas.
- CSS pode estilizar a barra de rolagem, mas o sistema operacional pode controlar a visibilidade de barras sobrepostas. Não prometa aparência igual em todos os aparelhos.

## Manutenção deste guia

Atualize uma decisão aqui quando um componente novo mudar a solução recomendada ou quando um limite de uso mudar. Não copie props, inventários completos de exports nem exemplos de código: confirme esses detalhes no código e na galeria. Organize por intenção; se uma família crescer a ponto de fazer o agente ler decisões não relacionadas, mova essa família para uma página própria e mantenha o link nesta página.
