# Modelagem do app residencial — PWA v1

**Estado:** modelo de produto consolidado para a v1. Define navegação, fluxos e comportamento; não é especificação visual nem implementação das telas residenciais.

**Estado atual do código:** a PWA e a API residencial com persistência PostgreSQL estão implementadas; produção ainda precisa ser configurada e validada. O cadastro público permanece fechado por padrão (`PUBLIC_SIGNUP_ENABLED=false`); enquanto isso, `https://chegadebriga.forjacorp.com/` apresenta o produto e a lista de espera, e `https://app.chegadebriga.forjacorp.com/` abre o app. `/componentes` é uma galeria de desenvolvimento, não uma página pública.

## Fontes de verdade

- Este documento: telas, jornadas e regras de produto do app residencial.
- [Design system](../design-system/README.md): marca, tokens e regras visuais.
- [Escolha de componentes](../design-system/componentes.md): quando usar cada componente ou padrão. APIs ficam no código em `apps/web/src/components`.
- [Contrato do backend residencial e deploy](./backend-deployment-contract-v1.md): autenticação, API, segurança e operação; não redefine regras de produto daqui.
- [Contrato do backend administrativo](./admin-backend-contract.md): entidades e operações do console.

Não duplicar aqui cores, espaçamentos, props ou inventário de componentes. Antes de criar componentes, comparar as necessidades validadas com o código e com a galeria `/componentes`.

## Landing, lista de espera e primeiro uso

A landing em `chegadebriga.forjacorp.com/` apresenta o benefício do produto, demonstra Início, Tarefas/Rotinas e Compras, explica o fluxo, responde dúvidas frequentes e oferece a lista de espera. A navegação usa âncoras para tarefas/rotinas, compras e inscrição; login, privacidade e cadastro ficam em `app.chegadebriga.forjacorp.com`; a galeria `/componentes` fica restrita ao ambiente de desenvolvimento. O botão de cadastro público só aparece quando `PUBLIC_SIGNUP_ENABLED` estiver habilitada no servidor.

Na lista de espera, a pessoa escolhe e-mail ou WhatsApp, informa somente o contato e autoriza explicitamente o aviso de abertura pelo canal escolhido. O aviso de privacidade explica finalidade, retenção e remoção. Nesta fase não há envio automático de e-mail, SMS ou WhatsApp. A implementação e os limites de dados ficam no [contrato de backend e deploy](./backend-deployment-contract-v1.md).

Após criar uma casa vazia, Início mostra uma orientação curta: criar tarefa/rotina (ação principal) ou adicionar um item de compras. Não há tour, conteúdo falso, convite ou push obrigatório. O cartão desaparece depois da primeira tarefa/rotina ou do primeiro item de compras novo; duplicatas e atualizações não contam. A casa guarda um marco persistente para o cartão não voltar após concluir uma compra ou recarregar. Convites e casas com atividade existente vão direto para a tela habitual.

A barra inferior é a navegação definida para as áreas residenciais. O `MobileMenu` atual atende links do shell público/administrativo; não presumir que ele seja a barra de abas do morador. Ao implementar o shell residencial, atualizar o guia de componentes com a distinção.

**Termos:** **Responsável da casa** é um papel de gestão. **Pessoa da vez** é quem foi escalado para uma ocorrência de tarefa. **Concluído por** registra quem realmente executou. Não tratar esses papéis como sinônimos.

## Decisões do modelo v1

| Tema | Regra |
| --- | --- |
| Plataforma | A primeira versão será uma PWA instalável. |
| Navegação | Três destinos: **Início**, **Tarefas** e **Compras**. Em Tarefas: **Hoje**, **Semana** e **Rotinas**. |
| Atraso de rotina | Ocorrências atrasadas não viram cópias acumuladas. A rotina fica representada por uma ocorrência pendente; ao concluí-la, o próximo vencimento é a próxima data futura da programação. |
| Permissões de tarefas | Qualquer morador ativo pode criar, editar, assumir, concluir, pular, pausar, retomar e encerrar tarefas e rotinas compartilhadas. Somente o responsável da casa administra a casa, os membros e os convites. |
| Saída de morador | Ao sair ou ser removida, a pessoa deixa de ser responsável por ocorrências abertas; tarefas fixas passam a **A combinar**. Ela é removida do revezamento, e o ciclo futuro continua entre os membros restantes. O histórico permanece. |
| Recorrência | Tarefas usam datas sem horário, no calendário e fuso da casa. A primeira data de uma rotina recorrente é hoje por padrão e pode ser alterada. Recorrências mensais em dia inexistente caem no último dia do mês. |
| Offline | Tarefas e rotinas previamente sincronizadas podem ser consultadas sem conexão, sem alterações. Compras permite consultar a última cópia e adicionar/marcar itens offline; as mudanças ficam locais até sincronizar, com conflito visível quando a mesma linha mudar em outro aparelho. |
| Estoque | O produto organiza itens que a casa precisa repor; não mantém contagem de unidades ou inventário doméstico. |
| Notificações | Incluídas na v1 como lembrete diário das tarefas da pessoa. A permissão é solicitada somente após ação explícita. |
| Esforço | Não há nota de justiça nem “esforço” universal. A v1 pode mostrar uma faixa opcional de tempo ativo típico, com escopo claro da ocorrência. |

## Escopo da versão

### Incluído

- Conta de morador, casas às quais pertence e convites para entrar.
- Tarefas únicas e rotinas recorrentes, com responsável por rotina.
- Lista compartilhada contínua de reposição, com prioridade opcional para itens que precisam ser comprados antes da próxima compra.
- Perfil pessoal, seleção de casa, gestão de moradores/convites e encerramento da casa por responsável.
- Notificação push diária das tarefas vencidas ou previstas para aquele dia, para a própria pessoa.
- Consulta offline das tarefas e rotinas previamente sincronizadas, mais edição offline limitada à lista de compras, depois que a pessoa entrou na conta e carregou os dados naquele aparelho.

### Fora do escopo inicial

- Contagem de estoque, consumo previsto, código de barras ou sugestão automática de quantidade.
- Calendário de compras, ciclo mensal, planejamento de ida ao mercado ou histórico de compras.
- Nota automática de justiça, competição, ranking de moradores ou redistribuição automática de tarefas.
- Edição offline de tarefas, rotinas, convites, perfil ou dados da casa.
- Fazer a mudança offline aparecer imediatamente no aparelho de outro morador. Isso acontece depois da sincronização.

## Navegação

O app autenticado tem três destinos principais na barra inferior:

1. **Início** — resumo do que requer atenção.
2. **Tarefas** — ocorrências e rotinas da casa.
3. **Compras** — lista compartilhada de reposição.

O cabeçalho das três telas principais mostra a casa ativa, que abre a seleção de casas, e o avatar, que abre a conta pessoal. Gestão da casa fica vinculada à casa selecionada, não ao perfil pessoal.

```text
Sem sessão
├── Entrar
├── Criar conta por convite ou autorização
├── Recuperar senha / redefinir senha
├── Aviso de privacidade
└── Prévia e aceitação de convite

Com sessão
├── Sem casa → aceitar convite ou criar casa
└── Casa ativa
    ├── Início
    ├── Tarefas
    │   ├── Hoje
    │   ├── Semana
    │   ├── Rotinas
    │   ├── Detalhe da tarefa/rotina
    │   └── Criar/editar tarefa ou rotina
    ├── Compras
    ├── Seletor de casa → gerenciar casa → moradores e convites
    └── Perfil → dados pessoais, senha, preferências e sair
```

Se houver mais de uma casa, manter a última casa escolhida como ativa e permitir troca pelo cabeçalho. Não presumir que a pessoa tem apenas uma casa.

## Estrutura padrão das telas

### Tela principal de uma seção

1. Área segura do aparelho e cabeçalho: casa ativa, perfil e estado de conexão/sincronização quando necessário.
2. Título. Acrescentar uma frase de contexto somente quando a tela tiver uma regra, consequência ou pré-requisito que não seja óbvio pelo título; a frase deve nomear esse ponto. Omiti-la em listas familiares como Hoje e Compras.
3. Ação principal da seção, sem competir com ações secundárias.
4. Conteúdo rolável em uma coluna, com filtros ou segmentos no início quando necessários.
5. Estado específico: conteúdo, vazio, carregando, erro recuperável ou dados desatualizados/offline.
6. Barra inferior com Início, Tarefas e Compras.

### Tela secundária ou formulário

- Cabeçalho com voltar, título e ação contextual quando houver.
- Formulário de tarefa em uma tela, sem etapas artificiais. Usar rodapé fixo para salvar quando o formulário exigir rolagem.
- Esconder a barra inferior em formulários de foco total; manter um caminho de voltar claro e preservar rascunho se a pessoa tentar sair com alterações.
- Bottom sheet para uma escolha curta, contextual à tela atual e que devolve a pessoa ao mesmo ponto, como selecionar casa, morador, responsabilidade ou escopo da edição. Usar uma folha por vez; não usar sheet como navegação nem para formulários longos.
- Diálogo de confirmação para ações com consequência importante e difícil de reverter, como excluir a casa, sair dela com responsabilidades compartilhadas ou encerrar uma rotina. O texto explica o efeito e o botão confirma pelo nome da ação. Ações comuns e reversíveis — concluir tarefa, pular ocorrência, pausar rotina, marcar item comprado — são diretas e oferecem **Desfazer** quando a reversão é segura.
- Formulário completo, como criar ou editar rotina, ocupa a tela. Escolha simples pertence a um bottom sheet; confirmação de perda importante pertence a um diálogo.

## Wireframes textuais

Os blocos indicam a ordem e a função dos elementos; textos e aparência serão detalhados depois conforme o design system.

### 1. Entrar, criar conta e convite

**Entrar**

1. Marca compacta e tema, sem navegação principal.
2. E-mail e senha; mostrar/ocultar senha.
3. Ação **Entrar** e link **Esqueci minha senha**.
4. Link para criar conta quando houver convite ou autorização.
5. Erro junto ao formulário, preservando os campos preenchidos.

**Criar conta por convite** mostra a casa e o e-mail vinculado ao convite. A pessoa pode entrar na conta existente ou criar conta. Após autenticar, o convite aceito cria o vínculo com a casa. Convite expirado, revogado ou já usado tem uma explicação e um caminho para pedir novo convite.

**Primeiro acesso após login:** sem vínculo, mostrar aceitar convite ou criar casa conforme a elegibilidade da conta; com uma casa, abrir Início; com várias, usar a última casa ou pedir seleção.

### 2. Início

**Cabeçalho:** `[Casa ativa ▾]` à esquerda, avatar à direita. O estado offline não ocupa espaço quando tudo está sincronizado.

**Conteúdo, de cima para baixo:**

1. Saudação e resumo curto da casa.
2. **Atenção hoje:** tarefas atrasadas e vencendo hoje, cada uma levando ao detalhe. A mesma rotina não é copiada no resumo.
3. Link **Ver semana** para a distribuição por dia e morador.
4. **Compras:** quantidade de itens pendentes e quantos estão marcados **Comprar antes**. Link para Compras.
5. Ações rápidas **Nova tarefa** e **Adicionar item**, que abrem os fluxos próprios.
6. Barra inferior fixa.

Casa sem tarefas mostra um convite claro para criar a primeira tarefa/rotina. Casa sem itens mostra uma ação para adicionar o primeiro item.

Quando a casa ainda não tem tarefa nem item de compras e não registrou primeiro valor, mostrar o cartão de primeiro uso com as duas ações descritas acima. As inclusões offline contam depois que chegam ao servidor; o marco é gravado uma única vez na casa.

### 3. Tarefas

**Cabeçalho:** casa ativa, perfil e título **Tarefas**. Ação primária **Nova tarefa**.

Controle de seção: **Hoje | Semana | Rotinas**. Filtro secundário por **Todos** ou morador; começar em Todos.

- **Hoje:** atrasadas primeiro, depois tarefas de hoje, e uma seção **Sem data** para tarefas únicas sem prazo. Cada linha mostra título, responsável ou **A combinar**, vencimento e ação de concluir. Em **A combinar**, qualquer morador pode tocar **Assumir**; isso registra a pessoa explicitamente.
- **Semana:** lista cronológica agrupada por dia, com pessoa da vez e frequência. A tela deixa visível quando o fim de semana concentra tarefas. Ela não declara se a divisão é justa.
- **Rotinas:** rotinas ativas com frequência, próxima data e modo de responsabilidade. Rotinas pausadas ficam em uma seção recolhida.
- Uma tarefa única aparece em Hoje, Semana ou na seção **Sem data** de Hoje até ser concluída; depois sai das listas abertas. A rotina recorrente mantém histórico no próprio detalhe.
- Sem conexão, **Hoje**, **Semana**, **Rotinas** e detalhes mostram a última cópia sincronizada, com horário da atualização. O conteúdo fica somente para consulta; ações de assumir, concluir, editar, pular, pausar, retomar e encerrar ficam indisponíveis até a reconexão.

Selecionar uma linha abre o detalhe. Qualquer morador pode concluir uma tarefa; o app registra quem estava responsável e quem realmente concluiu. Para tarefa atrasada, a ação resolve a única ocorrência pendente; o próximo vencimento usa a próxima data futura programada.

### 4. Detalhe de tarefa ou rotina

1. Título, estado, escopo do que conta como concluído e próximo vencimento.
2. Frequência e dias selecionados, quando recorrente.
3. Responsável pela ocorrência ou estado **A combinar**.
4. Instruções opcionais.
5. Histórico curto da rotina: data, pessoa escalada e pessoa que concluiu, se forem diferentes.
6. Ações **Editar**, **Pular esta ocorrência**, **Pausar rotina** e **Encerrar rotina** para recorrentes; **Concluir** para ocorrência aberta.

**Pular esta ocorrência** registra que esse ciclo foi deliberadamente pulado, sem criar atraso nem cópia; no revezamento, consome a vez e avança para a próxima pessoa. Depois disso, a próxima ocorrência segue a próxima data futura da programação. **Pausar** impede novas ocorrências e mantém a ocorrência atual pendente, se existir. Para removê-la, a pessoa deve pulá-la antes ou depois de pausar. Retomar pergunta a próxima data; datas durante a pausa não são recriadas. **Encerrar rotina** interrompe novas ocorrências e preserva o histórico; uma ocorrência que já estava aberta continua visível até ser concluída ou pulada.

### 5. Criar ou editar tarefa/rotina

Formulário único, com **Salvar** no rodapé. Campos propostos:

| Campo | Regra |
| --- | --- |
| Nome | Obrigatório; exemplo concreto, como “Lavar o banheiro”. |
| Repetição | Obrigatório escolher **Uma vez** ou **Recorrente**; sem frequência presumida. |
| Programação | Uma vez: data opcional; sem data, aparece em **Sem data**. Recorrente: escolher a primeira data, hoje por padrão. **Diária** ocorre em cada data do calendário; **dias da semana** repete em cada dia selecionado, semanalmente; **quinzenal** repete a cada 14 dias a partir da primeira data; **mensal** repete no mesmo dia da primeira data. Se o dia mensal não existir, usar o último dia daquele mês e manter o dia original como referência para os meses seguintes. |
| Responsável | Tarefa única: escolher uma pessoa ou **A combinar**. Rotina: **Pessoa fixa**, **Revezamento** ou **A combinar**. Em A combinar, qualquer morador pode tocar **Assumir**; até alguém assumir, a pendência fica visível e sem responsável implícito. |
| O que conta como concluído | Texto curto obrigatório quando o nome não define o tamanho normal da tarefa; opcional nos casos óbvios. Exemplo: “louça do jantar do dia a dia”. |
| Tempo ativo típico | Opcional: **Até 15 min**, **16–45 min** ou **Mais de 45 min**, contando uma ocorrência normal completa e sem tempo de espera. O rótulo é contextual, não pontuação de esforço ou justiça. |

Em **Pessoa fixa**, selecionar uma pessoa. Em **Revezamento**, selecionar pessoas e ordem. A pessoa escalada permanece responsável enquanto a ocorrência estiver aberta, inclusive em atraso. No revezamento, concluir ou pular consome a vez e avança para a próxima pessoa; se outro morador concluir, o app registra esse executor, mas a vez continua avançando. Em **Pessoa fixa**, concluir ou pular mantém a mesma pessoa responsável pelas próximas ocorrências.

**Calendário da casa:** cada casa guarda o fuso horário do aparelho usado na criação; esse fuso não muda conforme o aparelho de quem consulta. Todas as datas de tarefas são datas locais sem horário. Nos dias da semana, a primeira ocorrência é o primeiro dia selecionado que cai na data inicial ou depois dela. Em uma rotina mensal iniciada no dia 31, por exemplo, fevereiro ocorre no dia 28 ou 29 e março volta ao dia 31. Para data única sem data de vencimento, a tarefa aparece em **Sem data**.

Ao editar uma ocorrência recorrente, escolher **Só esta ocorrência** ou **Esta e as próximas**. A primeira opção salva uma exceção e deixa a programação futura intacta; a segunda atualiza a série a partir desta data, preservando o histórico anterior. Alterar frequência é uma mudança da série e, portanto, só pode valer para esta e as próximas.

**Critério de tempo:** os cortes de 15 e 45 minutos são uma convenção operacional do produto, não um padrão científico. Estudos usam duração e frequência, mas ressaltam que tempo não captura bem custo físico, mental ou satisfação. O FIA-Q10 mede quatro partes do trabalho com alimentação doméstica (planejar, obter, preparar e limpar); outro estudo de carga doméstica recomenda combinar duração e frequência com medidas de carga mental e satisfação. Para reduzir a ambiguidade, a pessoa estima uma ocorrência normal com o escopo escrito e sem contar espera; se a tarefa varia muito, considera o caso que acontece com mais frequência. Exemplo: “louça do jantar do dia a dia” define a rotina; a louça de um almoço de família pode ser uma tarefa única separada. Não calcular total, peso ou “nota de equilíbrio” a partir dessas faixas.

### 6. Compras

**Cabeçalho:** casa ativa, perfil e título **Compras**. Quando offline, exibir aviso curto com horário da última sincronização e mudanças pendentes.

**Conteúdo:**

1. Campo de adição rápida com nome e botão **Adicionar**; a lista tem uma única fonte contínua, sem data ou ciclo de compras.
2. Duas seções: **Na próxima compra** (padrão) e **Comprar antes** (prioridade opcional para algo que acabou antes da ida maior). Isso representa urgência, não agenda ou compra mensal programada.
3. Quantidade é opcional e texto livre, como “2 caixas” ou “1 kg”. Sem quantidade, o app não presume embalagem, unidade ou estoque.
4. Linha do item: nome, quantidade se houver, observação opcional e controle para marcar comprado. Um item já comprado sai da lista ativa; um toast oferece **Desfazer** por alguns segundos. Não há histórico/seção de comprados na v1.
5. Se o mesmo item já estiver ativo, abrir a linha existente para ajustar quantidade ou prioridade em vez de criar outra. Linhas diferentes de propósito devem ter nomes que as distingam, por exemplo marca ou tipo.

A casa mantém a lista enquanto houver necessidade. A compra pode ser mensal, semanal ou feita em pequenas idas: o app não impõe periodicidade e não inicia uma nova lista por mês. A lista pode evitar duplicatas entre moradores que adicionem o mesmo item, mas não sabe se ainda há unidades em casa; ela registra o que a casa decidiu repor, não substitui a conferência do armário. Um estudo de modelagem (não um teste de produto) encontrou uma troca entre flexibilidade de idas frequentes e coordenação de compras, que varia com a incerteza das necessidades. A pesquisa não aponta uma frequência universal; a escolha por uma lista contínua é uma inferência de produto para acomodar rotinas diferentes, não evidência de que a lista, sozinha, reduza desperdício.

**Offline:** mostrar a última lista carregada no aparelho; permitir adicionar e marcar/desmarcar comprado; persistir cada ação localmente; informar **Pendente de sincronização**. Quando voltar a haver conexão, sincronizar ao abrir/retomar o app e tentar novamente se falhar. Uma pessoa sem conexão não vê as mudanças recentes do outro morador. Se este aparelho nunca carregou a lista, explicar que precisa sincronizar uma vez para consultar os itens existentes, sem exibir uma lista vazia enganosa.

Tarefas e rotinas seguem outro limite offline: a última cópia sincronizada fica disponível para consulta, mas nenhuma alteração é enfileirada. Se não houver cópia local, mostrar que é preciso conectar uma vez para carregar os dados. Perfil, convites e gestão da casa exigem conexão.

**Conflitos:** cada ação local recebe um identificador único e pode ser reenviada sem duplicar o efeito. A sincronização mescla adições iguais em uma única linha ativa; nunca soma quantidades automaticamente. Se dois aparelhos alterarem a mesma linha, a linha mostra **Mudou em outro aparelho** e oferece **Usar versão compartilhada** ou **Manter minha mudança**. Em adições duplicadas, preencher uma quantidade que estava vazia; se as quantidades forem diferentes, pedir que a pessoa escolha ou combine manualmente. A segunda opção grava uma nova alteração compartilhada. Uma adição de item igual a uma linha que já foi comprada cria uma nova necessidade ativa.

**Retenção local:** enquanto a pessoa estiver conectada, manter a última cópia sincronizada de tarefas, rotinas e compras, além das ações de compra ainda pendentes. Pedir armazenamento persistente quando disponível, sem prometer que o navegador não removerá dados. Ao sair da conta, apagar os dados locais da casa. Se houver ações de compra pendentes, tentar sincronizar primeiro; sem conexão, explicar quantas mudanças podem ser descartadas e pedir confirmação explícita antes de sair. A interface nunca garante que alterações não sincronizadas estejam protegidas contra limpeza do armazenamento.

**Implementação atual:** o service worker mantém o shell da PWA; IndexedDB armazena a sessão em cache, a última cópia da casa e ações de compras pendentes. Tarefas e rotinas ficam somente para consulta offline. A lista sincroniza ao abrir e quando a conexão retorna; conflitos de versão são resolvidos na interface. Em primeiro plano, o app atualiza dados compartilhados ao retomar a aba e a cada 30 segundos. O app solicita armazenamento persistente quando o navegador oferece a API, sem garantir que a solicitação será aceita. Background Sync não é requisito do fluxo.

### 7. Seletor e gestão da casa

**Seletor de casa** abre ao tocar no nome da casa:

1. Lista das casas em que a pessoa participa; a ativa está identificada.
2. Selecionar outra casa troca o contexto.
3. Ações **Gerenciar esta casa** e **Criar/entrar em outra casa**.

**Gerenciar casa** mostra nome e moradores. A ação **Moradores e convites** leva à lista de membros, papéis e convites pendentes. O formulário **Convidar morador** pede e-mail; a pessoa convidada recebe um link vinculado à casa. Convites pendentes podem ser reenviados ou revogados; mostrar estado e expiração. Revogar ou remover alguém pede confirmação.

Papéis acordados: responsável pode editar a casa e gerir moradores/convites; qualquer morador ativo pode criar, editar, atribuir, assumir, concluir, pular, pausar, retomar e encerrar tarefas e rotinas compartilhadas, além de gerenciar a lista de compras. Convites e transferência de responsabilidade são ações do responsável. Deve sempre restar ao menos um responsável.

**Sair da casa** remove apenas a participação daquela pessoa; a conta e os dados da casa continuam. Qualquer morador pode sair, mas o último responsável precisa transferir o papel antes. Tarefas abertas atribuídas à pessoa passam a **A combinar**. Nas rotinas de **Pessoa fixa**, a ocorrência aberta e as próximas passam a **A combinar**. Nas rotinas de **Revezamento**, a ocorrência aberta passa a **A combinar**, a pessoa sai da ordem e o próximo ciclo segue para o próximo morador ativo na ordem existente; se ninguém restar na ordem, a rotina vira **A combinar**. O histórico não muda. A mesma regra vale quando o responsável remove um morador. **Excluir casa** apaga permanentemente tarefas, rotinas, lista e histórico compartilhados para todos; só o responsável pode fazê-lo, com confirmação explícita de que a ação é irreversível e afeta os demais. Se for a única pessoa da casa, pode excluí-la sem transferência. Excluir a conta é um fluxo separado.

### 8. Perfil

Acessível pelo avatar, separado da gestão da casa:

1. Nome e e-mail da conta.
2. Editar nome; alterar e-mail/senha em fluxo autenticado.
3. Lembrete diário: ativar/desativar e escolher o horário; padrão **08:00** no fuso da casa (escolha de produto, editável por pessoa). A notificação lista as tarefas atribuídas à pessoa, vencidas ou previstas para aquele dia; **A combinar** não gera push antes de alguém assumir. Não enviar push para cada mudança na lista de compras. Solicitar permissão somente após a pessoa tocar **Ativar notificações**; se o aparelho/navegador não aceitar push ou a permissão for negada, as tarefas continuam visíveis no Início enquanto o app estiver aberto, sem simular uma notificação do sistema.
4. Link para **Aviso de privacidade**, também disponível antes de criar conta.
5. **Baixar meus dados** gera a exportação JSON da conta e dos registros compartilhados acessíveis, sem expor e-mails de outros moradores.
6. **Excluir conta** abre uma tela própria que explica o impacto e, quando necessário, conduz à transferência da responsabilidade. A confirmação final é contextual; seguir os padrões canônicos do [guia de componentes](../design-system/componentes.md). Se a pessoa for a única moradora de uma casa, essa casa e seus dados são apagados junto. Se for a última responsável em uma casa com outras pessoas, precisa transferir o papel antes.
7. **Sair**.

O conteúdo da exportação, a exclusão/anonimização e os prazos de retenção são definidos em [backend-deployment-contract-v1.md](./backend-deployment-contract-v1.md); este documento mantém apenas o comportamento visível para a pessoa.

## Regras transversais e estados

- Estados de carregamento, vazio, erro e sucesso têm mensagem e ação adequadas; erro de rede oferece tentar novamente sem limpar o formulário. Feedback breve de sucesso usa um toast por vez, por até seis segundos, com ação opcional de desfazer; foco de teclado ou hover de mouse/caneta pausa o tempo. Erro que impede continuar ou sincronização pendente permanece visível na tela.
- Sem conexão, distinguir dados locais desatualizados de lista realmente vazia. Informar quando há mudanças pendentes e se a sincronização falhou.
- Ações concluídas podem ser desfeitas por curto período quando a reversão ainda é segura. O toast não substitui confirmação nem o estado persistente de erro; ações destrutivas como excluir casa pedem confirmação contextual.
- Toast é feedback dentro do app, não notificação do sistema. O status é anunciado sem mover o foco; **Desfazer** é um botão acessível. Falhas persistentes e conflitos de sincronização não desaparecem em toast.
- Membros veem a mesma lista da casa; dados offline de um aparelho não são apresentados como se já estivessem compartilhados.
- Não usar contagem de tarefas como veredito de equilíbrio. A pesquisa descreve o trabalho doméstico cognitivo como antecipar, identificar, decidir e monitorar; duração também não mede sozinha a carga mental. A semana mostra o combinado, e a faixa de tempo informa duração provável sem se apresentar como medida de justiça.

## Caminhos de cobertura

| Necessidade | Caminho de acesso |
| --- | --- |
| Ver o que precisa ser feito | Barra inferior → Tarefas → Hoje ou Semana |
| Conferir como as responsabilidades se distribuem | Barra inferior → Tarefas → Semana; filtrar por morador |
| Criar/editar rotina e frequência | Tarefas → Nova tarefa ou Rotinas → selecionar item → Editar |
| Concluir tarefa atrasada | Início ou Tarefas → linha atrasada → Concluir |
| Adicionar/consultar compras | Barra inferior → Compras → campo de adição ou item |
| Trocar de casa | Cabeçalho → casa ativa → selecionar outra |
| Editar nome da casa ou convidar morador | Cabeçalho → casa ativa → Gerenciar esta casa → Moradores e convites |
| Editar perfil ou sair | Cabeçalho → avatar → Perfil |
| Entrar em casa por convite | Link do convite → prévia → entrar/criar conta → aceitar → Início |

## Próximo passo

As decisões de produto necessárias para desenhar os fluxos da v1 estão fechadas. O inventário comparou esses fluxos com os componentes existentes; Toast já cobre feedback reversível. `BottomSheet` e `ConfirmDialog` foram adicionados para escolhas curtas e confirmações importantes. O shell residencial e telas navegáveis continuam demonstrações locais, sem conexão com o backend. Expiração de convites, exclusão/exportação/retenção de conta e contrato de sincronização já têm regras documentadas nos contratos de backend.

Push exige integração de backend e permissão do aparelho; a modelagem define o comportamento, mas o código atual não envia notificações. No iOS/iPadOS, Web Push está disponível para web apps adicionados à Tela de Início desde a versão 16.4 e exige ação direta para solicitar permissão. A sincronização offline também depende de contrato/backend residencial ainda inexistente.

## Referências de apoio

- [Apple Human Interface Guidelines: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Apple Human Interface Guidelines: Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
- [Apple Human Interface Guidelines: Action sheets](https://developer.apple.com/design/human-interface-guidelines/action-sheets)
- [Apple Human Interface Guidelines: Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts)
- [Android: padrões de navegação](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)
- [Android Developers: bottom sheets](https://developer.android.com/develop/ui/compose/components/bottom-sheets)
- [Android Developers: diálogos](https://developer.android.com/develop/ui/compose/components/dialog)
- [W3C WAI-ARIA APG: diálogo modal e foco](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [RFC 7529: datas inválidas em recorrências mensais e convenção de último dia do mês](https://www.rfc-editor.org/rfc/rfc7529#section-4.1)
- [W3C: formulários](https://www.w3.org/WAI/tutorials/forms/)
- [MDN: IndexedDB e armazenamento offline](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology)
- [MDN: cotas e remoção de dados do navegador](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [MDN: suporte limitado de Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [Harvard: dimensão cognitiva do trabalho doméstico](https://inequality.hks.harvard.edu/publications/cognitive-dimension-household-labor)
- [Estudo sobre percepções de justiça na divisão do trabalho doméstico](https://journals.sagepub.com/doi/10.1177/0192513X21993899)
- [FIA-Q10: medida de tempo em planejamento, obtenção, preparo e limpeza da alimentação doméstica](https://pubmed.ncbi.nlm.nih.gov/39609806/)
- [Carga temporal e mental do trabalho administrativo doméstico: limitações de medir somente duração](https://pub.h-brs.de/files/8560/socsci-13-00404.pdf)
- [Trabalho cognitivo doméstico: antecipar, identificar, decidir e monitorar](https://pmc.ncbi.nlm.nih.gov/articles/PMC11761833/)
- [Estudo de modelagem sobre frequência de compras, incerteza e desperdício alimentar](https://www.sciencedirect.com/science/article/pii/S2352550925001137)
- [W3C: mensagens de estado acessíveis com `role="status"`](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)
- [WebKit: Web Push em web apps instalados no iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
