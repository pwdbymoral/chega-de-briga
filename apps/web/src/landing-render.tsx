import { renderToString } from "react-dom/server";
import { PublicSite } from "./landing/PublicSite";
import { editorialDate, publicationDate, publicPageInfo, siteOrigin } from "./landing/pages";
import type { PublicPage } from "@chega-de-briga/domain";

export const pages = publicPageInfo;
export const origin = siteOrigin;
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function renderPage(page: PublicPage | "not_found", indexable: boolean) {
  const info = page === "not_found" ? { title: "Página não encontrada | Chega de Briga", description: "Volte ao início para conhecer o Chega de Briga.", path: "/404.html" } : pages[page];
  const url = siteOrigin + info.path;
  const organization = { "@type": "Organization", "@id": `${siteOrigin}/#organization`, name: "ForjaCorp", url: siteOrigin, logo: `${siteOrigin}/pwa-512.png` };
  const structured = page === "landing" ? { "@context": "https://schema.org", "@graph": [organization, { "@type": "WebSite", "@id": `${siteOrigin}/#website`, name: "Chega de Briga", url: siteOrigin, inLanguage: "pt-BR", publisher: { "@id": organization["@id"] } }] }
    : { "@context": "https://schema.org", "@type": "Article", headline: info.title.replace(" | Chega de Briga", ""), description: info.description, mainEntityOfPage: url, inLanguage: "pt-BR", datePublished: publicationDate, dateModified: editorialDate, author: organization, publisher: organization };
  const head = [
    `<title>${escape(info.title)}</title>`,
    `<meta name="description" content="${escape(info.description)}" />`,
    `<meta name="robots" content="${indexable && page !== "not_found" ? "index, follow" : "noindex, follow"}" />`,
    ...(page !== "not_found" ? [`<link rel="canonical" href="${url}" />`] : []),
    `<meta property="og:type" content="${page === "landing" ? "website" : "article"}" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:site_name" content="Chega de Briga" />`,
    `<meta property="og:title" content="${escape(info.title)}" />`,
    `<meta property="og:description" content="${escape(info.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${siteOrigin}/pwa-512.png" />`,
    `<meta property="og:image:alt" content="Símbolo do Chega de Briga" />`,
    `<meta name="twitter:card" content="summary" />`,
    ...(page !== "not_found" ? [`<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, "\\u003c")}</script>`] : []),
  ].join("\n    ");
  return { head, html: renderToString(<PublicSite page={page} />) };
}
