import type { PublicPage } from "@chega-de-briga/domain";

export const siteOrigin = "https://chegadebriga.forjacorp.com";
export const publicationDate = "2026-10-13";
export const editorialDate = "2026-10-13";
export const publicPageInfo: Record<PublicPage, { path: string; title: string; description: string }> = {
  landing: {
    path: "/",
    title: "Chega de Briga | Tarefas domésticas e compras compartilhadas",
    description: "Organize tarefas domésticas, rotinas, responsabilidades e compras em um app para quem divide a casa. Conheça o Chega de Briga e consulte a disponibilidade de acesso.",
  },
  tasks_guide: {
    path: "/guias/dividir-tarefas-domesticas/",
    title: "Como dividir tarefas domésticas | Chega de Briga",
    description: "Um guia prático para combinar tarefas, frequência, responsáveis e revezamento em uma casa compartilhada, com exemplo de divisão semanal.",
  },
  shopping_guide: {
    path: "/guias/lista-de-compras-compartilhada/",
    title: "Como organizar uma lista de compras compartilhada | Chega de Briga",
    description: "Combine o que falta, as quantidades e a prioridade das compras da casa. Veja um exemplo de lista compartilhada e como mantê-la atualizada.",
  },
};

export const acquisitionLabels = {
  unknown: "Origem desconhecida", google: "Google", bing: "Bing", chatgpt: "ChatGPT",
  perplexity: "Perplexity", copilot: "Copilot", gemini: "Gemini", claude: "Claude",
  other_campaign: "Outras campanhas", other_referral: "Outras referências", direct_unknown: "Direto / não identificado",
};
