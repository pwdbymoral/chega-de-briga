import { build, loadEnv } from "vite";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const env = { ...loadEnv("landing", process.cwd(), ""), ...process.env };
if (env.LANDING_INDEXABLE !== undefined && !["true", "false"].includes(env.LANDING_INDEXABLE)) {
  throw new Error("LANDING_INDEXABLE must be true or false.");
}
const indexable = env.LANDING_INDEXABLE === "true";
const output = resolve("dist-landing");
await build({ mode: "landing" });
await mkdir("node_modules/.cache", { recursive: true });
const temporary = await mkdtemp(resolve("node_modules/.cache/landing-"));
try {
  await build({ mode: "landing", publicDir: false, build: { ssr: "src/landing-render.tsx", outDir: temporary, emptyOutDir: true } });
  const { renderPage, pages, origin } = await import(pathToFileURL(resolve(temporary, "landing-render.js")).href);
  const template = (await readFile(resolve(output, "index.html"), "utf8"))
    .replace(/\s*<title>.*?<\/title>/s, "")
    .replace(/\s*<meta name="description"[^>]*>/, "");
  if (!template.includes('<div id="root"></div>')) throw new Error("Landing root placeholder missing.");
  for (const [page, info] of [...Object.entries(pages), ["not_found", { path: "/404.html" }]]) {
    const { head, html } = renderPage(page, indexable);
    const destination = resolve(output, page === "not_found" ? "404.html" : `.${info.path}index.html`);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, template.replace("</head>", `    ${head}\n  </head>`)
      .replace('<div id="root"></div>', `<div id="root" data-page="${page}">${html}</div>`));
  }
  await writeFile(resolve(output, "robots.txt"), `User-agent: *\nAllow: /\n${indexable ? `\nSitemap: ${origin}/sitemap.xml\n` : ""}`);
  await writeFile(resolve(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable ? Object.values(pages).map(({ path }) => `  <url><loc>${origin}${path}</loc></url>`).join("\n") : ""}\n</urlset>\n`);
  if (indexable) await cp(resolve("landing-public"), output, { recursive: true });
  console.log(`Landing: 3 pages + 404; indexing ${indexable ? "enabled" : "disabled"}.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
