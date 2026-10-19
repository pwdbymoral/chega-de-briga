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
| Navegar para uma rota com aparência de ação | `LinkButton`, preservando a semântica de link e as variantes visuais de `Button`. Para navegação comum, use um link de texto. | A ação não navega; use `Button`. Não crie estilos locais para fazer um link parecer botão. |
| Organizar ações de um card ou item | `CardActions`, com principal opcional e secundárias. Mantém o conteúdo à esquerda e as ações à direita, compacta os controles e reúne múltiplas secundárias em “Mais ações”. | Formulários, Salvar/Cancelar, confirmações, filtros, paginação e escolhas de sincronização mantêm seus padrões próprios. Cards inteiramente clicáveis continuam sendo links únicos. |
| Escolher o tema | `Select` na apresentação de ação, com ícone e preferência selecionada: Sistema, Claro ou Escuro. Tema e Sair usam a aparência `secondary`; na sidebar e no menu móvel, ambos ocupam linhas de mesma largura com ícone e texto. Cabeçalhos estreitos podem compactar Tema. | Não combine um botão de alternância com outro seletor de tema. |
| Concluir uma tarefa | A principal de `CardActions`, com rótulo “Concluir” e compactação conforme o grupo. Depois da conclusão, ofereça `Desfazer` em um Toast quando a reversão for segura. | Não use `Checkbox` para uma ação de conclusão. |
| Executar uma ação apenas com ícone | `IconButton` para controles isolados. Em cards, deixe `CardActions` compactar `Button` e `LinkButton`, preservando a ênfase da principal. Todos precisam de nome acessível e tooltip. | Fora do padrão de cards, a ação cabe com rótulo ou exige interpretação: mostre o texto. |
| Navegar pelas rotas públicas ou administrativas em telas estreitas | `MobileMenu` no shell React com React Router. No console administrativo, use sidebar persistente em telas largas e `MobileMenu` em telas estreitas; mantenha ações e busca da tela à vista. | A área residencial tem três destinos principais e usa uma barra inferior persistente; não replique o menu do site ali. Para seções da mesma página, use links em `<nav>`; o manual estático segue esse padrão. |
| Fazer uma escolha curta e contextual, voltando ao mesmo ponto | `BottomSheet` com `<dialog>` nativo, como escolher uma casa ou o escopo de uma edição. | Não use como navegação principal nem para formulários longos; use uma tela própria. `MobileMenu` é um menu de rotas diferente. |
| Confirmar uma ação importante e difícil de reverter | `ConfirmDialog`. Explique o efeito e nomeie a ação no botão de confirmação. | Ações comuns e reversíveis, como concluir, pular, pausar ou marcar compra: execute diretamente e ofereça **Desfazer** com Toast quando a reversão for segura. |

## Ações de cards e itens

O grupo permanece à direita do conteúdo, sem quebrar linha, na ordem principal e secundária/menu. Texto do conteúdo pode ocupar várias linhas; rótulos dos controles não quebram. No mobile (até 650 px) ou em grupos com largura útil inferior a 32 rem:

| Ações disponíveis | Apresentação |
| --- | --- |
| Só principal | Ícone e texto |
| Principal e uma secundária | Dois botões compactos |
| Principal e duas ou mais secundárias | Principal compacta e Mais ações compacto |
| Só uma secundária | Ícone e texto com menor destaque |
| Duas ou mais secundárias, sem principal | Só Mais ações compacto |

Compacto significa somente ícone, com alvo mínimo de 48 × 48 px, nome acessível e tooltip. Em espaços maiores, mostre ícone e texto mantendo o agrupamento. Uma ação destrutiva nunca ganha destaque de principal apenas por estar sozinha.

O menu mostra opções textuais verticais, com destrutivas por último, e fecha ao selecionar, pressionar Escape ou clicar fora. Preserve confirmações, permissões e estados pendentes. Ao abrir uma confirmação, mantenha a sequência de foco; ao fechar por Escape, volte ao gatilho. O posicionamento usa a camada superior de popover com fallback e respeita as bordas da janela.

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

## Rótulo acima de título (eyebrow)

Use o rótulo em caixa alta acima de um título (`.eyebrow`) só quando ele carregar uma informação que o título não dá: a fase do fluxo em uma tela de autenticação sem indicador de etapas (ex. "Recuperar acesso", "Nova senha"), a categoria de um card entre vários (ex. "Tarefas e rotinas", "Lista de compras", reforçando o ícone para quem não depende só dele), o nome de uma seção que o título não deixa óbvio (ex. "Perguntas diretas" acima de um título figurado) ou um estado que muda em runtime (ex. fase de lançamento, disponibilidade de cadastro). Não use para parafrasear ou enfeitar o título logo abaixo: se o rótulo some e nenhuma informação se perde, remova-o. Reserve a assinatura de marca ("Casa compartilhada, vida mais leve") para um só lugar de destaque por tela (o herói ou o painel fixo de autenticação); não a repita como rótulo de outras seções da mesma página.

## Listas e rolagem

- Preserve nomes legíveis quando ações disputarem espaço; confira o arranjo compacto antes de aumentar a altura de todas as linhas.
- Evite rolagem vertical dentro de outra rolagem para conteúdo de leitura normal. Confira a rolagem renderizada, não apenas regras de `overflow` no CSS.
- Quando uma tabela não couber na tela, mantenha a tabela semântica dentro de um contêiner de rolagem horizontal focalizável e nomeado; impeça que a página inteira ganhe largura extra.
- Escolha busca, expansão ou paginação pela quantidade de itens e pela facilidade de encontrar um item; não pagine apenas para uniformizar telas.
- CSS pode estilizar a barra de rolagem, mas o sistema operacional pode controlar a visibilidade de barras sobrepostas. Não prometa aparência igual em todos os aparelhos.

## Manutenção deste guia

Atualize uma decisão aqui quando um componente novo mudar a solução recomendada ou quando um limite de uso mudar. Não copie props, inventários completos de exports nem exemplos de código: confirme esses detalhes no código e na galeria. Organize por intenção; se uma família crescer a ponto de fazer o agente ler decisões não relacionadas, mova essa família para uma página própria e mantenha o link nesta página.
