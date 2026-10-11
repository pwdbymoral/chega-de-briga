# Instruções do agente — Chega de Briga

Preserve as decisões aprovadas. Este arquivo guarda restrições que valem para diferentes tarefas; os documentos indicados abaixo são as fontes específicas.

## Antes de mudar

- Consulte [`README.md`](./README.md) quando precisar de comandos do projeto ou requisitos de publicação.
- Antes de qualquer mudança que altere interface, interação, estilo ou apresentação da PWA, use `$chega-de-briga-frontend`. A skill encaminha aos documentos canônicos pelo tipo de decisão.
- Use fontes únicas: convenções gerais de implementação ficam em [`design-system/README.md`](./design-system/README.md); escolhas e limites de componentes, em [`design-system/componentes.md`](./design-system/componentes.md). O [`index.html`](./design-system/index.html) é visual: pode demonstrar os padrões e apontar para os guias, sem copiar suas instruções. Em outros documentos de agente, use links.
- Não conecte backend, autenticação ou envio de e-mail reais, nem inclua o console no build público, sem pedido explícito.
- Backend, autenticação, dados residenciais, e-mail, push ou deploy: consulte [`docs/backend-deployment-contract-v1.md`](./docs/backend-deployment-contract-v1.md) antes de implementar; ele centraliza as decisões aprovadas e os limites operacionais.
- Ao alterar acesso, console ou métricas, consulte o código afetado e [`docs/admin-backend-contract.md`](./docs/admin-backend-contract.md). Use o README para comandos e publicação.

## Como evitar retrabalho

- Inspecione o estado, os chamadores e o fluxo antes de editar. Se a intenção estiver ambígua, faltar informação necessária ou houver conflito de requisitos, pergunte antes da parte dependente; avance no trabalho independente enquanto aguarda. Para escolhas reversíveis de baixo impacto, siga os padrões do projeto e continue.
- Trate relatórios de agentes e ferramentas como hipóteses. Confirme cada achado no código e confira exatamente o que cada script mediu.
- Quando o usuário pedir para pesquisar, verificar, buscar fontes, citar referências ou fundamentar a resposta em evidências, pesquise e cite fontes primárias adequadas ao tema: documentação do mantenedor para APIs e ferramentas; normas ou órgãos responsáveis para requisitos; estudos primários ou revisões sistemáticas para alegações empíricas. Para fatos do app, priorize o código e os documentos do repositório. Diferencie afirmações das fontes de recomendações ou inferências e indique lacunas de verificação.
