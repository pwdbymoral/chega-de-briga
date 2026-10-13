import type { PublicPage } from "@chega-de-briga/domain";
import { editorialDate, publicationDate, publicPageInfo } from "./pages";
import { usePageView } from "./metrics";
import styles from "./PublicSite.module.css";

export function GuideLinks() {
  return <section className={styles.guides} id="guias" aria-labelledby="guides-title">
    <h2 id="guides-title">Combinados que saem do papel.</h2>
    <p>Dois guias para começar uma conversa prática sobre a rotina da casa.</p>
    <ul className={styles.guideLinks}>{(["tasks_guide", "shopping_guide"] as const).map((key) => (
      <li key={key}><a href={publicPageInfo[key].path}>{key === "tasks_guide" ? "Como dividir tarefas domésticas" : "Como organizar uma lista de compras compartilhada"}</a><p>{publicPageInfo[key].description}</p></li>
    ))}</ul>
  </section>;
}

function TaskGuide() {
  return <>
    <h1>Como dividir tarefas domésticas</h1>
    <p>Comecem listando o que precisa acontecer, combinem uma frequência e escolham quem fica responsável por cada tarefa. Registrem o acordo em um lugar que todos consigam consultar e reservem um momento para ajustar o que não funcionou.</p>
    <p>Dividir a casa não exige que todas as pessoas façam exatamente as mesmas coisas. O combinado precisa considerar tempo, disponibilidade e necessidades de quem mora junto. A proposta abaixo é um ponto de partida para essa conversa.</p>
    <h2>1. Coloquem o trabalho à vista</h2>
    <p>Façam uma lista que inclua tanto a execução quanto a preparação: lavar o banheiro, separar os produtos, perceber quando o sabão está acabando e colocar a reposição na lista. Perguntem o que hoje fica dependendo de alguém lembrar ou cobrar.</p>
    <ul><li><strong>Tarefas frequentes:</strong> lavar louça, tirar lixo e cuidar das áreas compartilhadas.</li><li><strong>Tarefas periódicas:</strong> limpar o banheiro, trocar roupas de cama e revisar alimentos guardados.</li><li><strong>Tarefas pontuais:</strong> receber uma entrega, acompanhar um reparo ou organizar um armário.</li></ul>
    <h2>2. Combinem frequência e resultado esperado</h2>
    <p>“Cuidar da cozinha” pode significar coisas diferentes. Um acordo mais claro seria “lavar a louça usada no jantar e deixar a pia livre”. Decidam também quando a tarefa precisa acontecer e o que fazer quando não for possível cumprir.</p>
    <p>A frequência deve acompanhar a rotina real. Não existe uma escala única que sirva para toda casa: revejam os dias quando mudarem os horários de trabalho, estudo ou descanso.</p>
    <h2>3. Escolham responsabilidade fixa ou revezamento</h2>
    <p>Uma pessoa pode assumir uma atividade de que gosta ou que cabe melhor no seu horário. Outras tarefas podem circular entre os moradores. Registrem a ordem do revezamento e combinem como avisar sobre trocas, sem depender de uma mensagem perdida.</p>
    <div className={styles.table} role="region" aria-label="Exemplo de divisão semanal" tabIndex={0}><table>
      <caption>Exemplo fictício para adaptar em uma casa com duas pessoas</caption>
      <thead><tr><th>Tarefa</th><th>Quando</th><th>Responsabilidade</th></tr></thead>
      <tbody><tr><th scope="row">Louça do jantar</th><td>Todos os dias</td><td>Júlia e Caio se revezam</td></tr><tr><th scope="row">Lixo</th><td>Antes da coleta local</td><td>Caio</td></tr><tr><th scope="row">Banheiro</th><td>Sábado</td><td>Júlia nesta semana; Caio na próxima</td></tr><tr><th scope="row">Revisar a lista de compras</th><td>Antes de ir ao mercado</td><td>Quem fará a compra confirma com a casa</td></tr></tbody>
    </table></div>
    <h2>4. Revisem o acordo, sem transformar a lista em placar</h2>
    <p>Depois da primeira semana, conversem sobre o que ficou pesado, o que ninguém entendeu e o que precisa mudar. Contar tarefas não mede sozinho o esforço: comparem também duração, dificuldade e disponibilidade.</p>
    <p>Se uma tarefa não aconteceu, registrem o próximo passo: trocar o responsável, mudar o dia ou rever a frequência. Usem a lista para orientar a rotina, sem expor ou culpar moradores.</p>
    <h2>Como registrar isso no Chega de Briga</h2>
    <p>O app permite tarefas únicas e rotinas recorrentes. Nas rotinas, a responsabilidade pode ser de uma pessoa fixa, seguir um revezamento ou ficar “A combinar”. Os moradores acompanham os combinados e podem atualizar as tarefas.</p>
    <p>Para conectar a rotina ao que falta comprar, veja também <a href={publicPageInfo.shopping_guide.path}>como organizar uma lista de compras compartilhada</a>.</p>
  </>;
}

function ShoppingGuide() {
  return <>
    <h1>Como organizar uma lista de compras compartilhada</h1>
    <p>Escolham uma lista que todos possam consultar, anotem cada necessidade assim que ela aparecer e indiquem quantidade e prioridade quando fizer diferença. Antes de comprar, confiram o que já existe em casa; depois, atualizem o que foi resolvido.</p>
    <p>A lista reúne decisões da casa. Ela funciona melhor quando as pessoas combinam o que entra nela e quem confere os itens antes de sair, em vez de manter várias versões em conversas diferentes.</p>
    <h2>1. Anotem o item de um jeito reconhecível</h2>
    <p>Prefiram um nome que outra pessoa consiga identificar. Se marca, tamanho ou tipo forem necessários, escrevam isso no item ou em uma observação. “Café em pó, pacote de 250 g” deixa menos espaço para dúvida que apenas “café”.</p>
    <h2>2. Confiram quantidade e prioridade</h2>
    <p>Quantidade é uma combinação, não uma previsão automática. Confiram o armário e escrevam “2 caixas” ou “1 kg” quando souberem o que precisam. Se ainda houver dúvida, confirmem com a casa antes de comprar.</p>
    <p>Separem o que pode esperar pela próxima compra do que precisa ser comprado antes. A prioridade não substitui o acordo sobre quem vai ao mercado nem significa que alguém recebeu uma tarefa automaticamente.</p>
    <div className={styles.table} role="region" aria-label="Exemplo de lista compartilhada" tabIndex={0}><table>
      <caption>Exemplo fictício de uma lista para a próxima compra</caption>
      <thead><tr><th>Item</th><th>Quantidade</th><th>Prioridade / observação</th></tr></thead>
      <tbody><tr><th scope="row">Leite</th><td>2 caixas</td><td>Comprar antes; confirmar o tipo usado pela casa</td></tr><tr><th scope="row">Café em pó</th><td>1 pacote de 250 g</td><td>Próxima compra</td></tr><tr><th scope="row">Detergente</th><td>1 frasco</td><td>Próxima compra; conferir o que já está aberto</td></tr></tbody>
    </table></div>
    <h2>3. Ajustem o item existente antes de criar outro</h2>
    <p>Ao perceber que falta algo, procurem primeiro na lista. Se já estiver anotado, confiram a quantidade e a prioridade em vez de repetir a linha. Se forem produtos diferentes de propósito, distingam seus nomes.</p>
    <h2>4. Atualizem a lista quando a compra acontecer</h2>
    <p>Marquem os itens comprados para que outra pessoa não compre a mesma necessidade novamente. Se um produto não foi encontrado, mantenham o item pendente e conversem sobre uma alternativa. Na próxima revisão, acrescentem só as novas necessidades.</p>
    <h2>Como fazer isso no Chega de Briga</h2>
    <p>A lista compartilhada do app aceita nome, quantidade opcional e observação. A prioridade “Comprar antes” destaca o que precisa de atenção. Marcar como comprado retira o item da lista ativa, com opção de desfazer logo após a ação.</p>
    <p>O app não calcula estoque nem sugere quantidades automaticamente. A decisão continua com a casa. Para combinar também as responsabilidades da rotina, leia <a href={publicPageInfo.tasks_guide.path}>como dividir tarefas domésticas</a>.</p>
  </>;
}

export function Guide({ page }: { page: Exclude<PublicPage, "landing"> }) {
  usePageView(page);
  return <article className={styles.article}>
    <a href="/">Chega de Briga</a>
    <p className={styles.byline}>Por ForjaCorp · Publicado em <time dateTime={publicationDate}>13/10/2026</time> · Revisado em <time dateTime={editorialDate}>13/10/2026</time></p>
    {page === "tasks_guide" ? <TaskGuide /> : <ShoppingGuide />}
    <aside className={styles.cta}><h2>Os combinados da casa, em um só lugar.</h2><p>Conheça o app e consulte a disponibilidade de cadastro ou da lista de espera.</p><a href="/#lista-de-espera">Ver disponibilidade de acesso</a></aside>
  </article>;
}
