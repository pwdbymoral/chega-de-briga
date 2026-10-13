import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const root = resolve("dist-landing");
const origin = "https://chegadebriga.forjacorp.com";
const paths = ["/", "/guias/dividir-tarefas-domesticas/", "/guias/lista-de-compras-compartilhada/"];
const documents = new Map();
for (const path of [...paths, "/404.html"]) {
  const html = await readFile(resolve(root, path === "/404.html" ? "404.html" : `.${path}index.html`), "utf8");
  documents.set(path, new JSDOM(html).window.document);
}
const indexable = documents.get("/").querySelector('meta[name="robots"]').content === "index, follow";
const titles = new Set();
for (const [path, document] of documents) {
  assert.equal(document.documentElement.lang, "pt-BR");
  assert.equal(document.querySelectorAll("h1").length, 1, path);
  assert.ok(document.querySelector("main").textContent.length > 60, path);
  assert.equal(document.querySelectorAll("title").length, 1, path);
  assert.ok(!titles.has(document.title), "Titles must be unique.");
  titles.add(document.title);
  assert.equal(document.querySelectorAll('meta[name="description"]').length, 1, path);
  assert.ok(document.querySelector('meta[property="og:image"]').content.startsWith(origin));
  if (path === "/404.html") {
    assert.equal(document.querySelector('meta[name="robots"]').content, "noindex, follow");
    assert.equal(document.querySelector('link[rel="canonical"]'), null);
  } else {
    assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1);
    assert.equal(document.querySelector('link[rel="canonical"]').href, origin + path);
    assert.equal(document.querySelector('meta[name="robots"]').content, indexable ? "index, follow" : "noindex, follow");
    assert.equal(JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)["@context"], "https://schema.org");
  }
  for (const element of document.querySelectorAll("a[href], img[src], script[src], link[href]")) {
    const target = element.getAttribute("href") ?? element.getAttribute("src");
    if (!target.startsWith("/") && !target.startsWith("#")) continue;
    const url = new URL(target, origin + path);
    const page = documents.get(url.pathname);
    if (page) {
      if (url.hash) assert.ok(page.getElementById(url.hash.slice(1)), `Missing anchor: ${target}`);
    } else {
      assert.ok((await stat(resolve(root, `.${url.pathname}`))).isFile(), `Missing asset: ${target}`);
    }
  }
}
assert.ok(documents.get("/").querySelector("noscript").textContent.includes("JavaScript"));
assert.ok(documents.get("/").body.textContent.includes("Ver disponibilidade"));
assert.equal(documents.get("/").querySelector("form"), null, "Availability must come from runtime.");
const sitemap = new JSDOM(await readFile(resolve(root, "sitemap.xml"), "utf8"), { contentType: "application/xml" });
assert.deepEqual([...sitemap.window.document.querySelectorAll("loc")].map((node) => node.textContent), indexable ? paths.map((path) => origin + path) : []);
const robots = await readFile(resolve(root, "robots.txt"), "utf8");
assert.match(robots, /User-agent: \*\nAllow: \//);
assert.equal(robots.includes(`Sitemap: ${origin}/sitemap.xml`), indexable);
const files = await readdir(root, { recursive: true });
assert.ok(!files.some((file) => /(?:^|\/)(?:sw\.js|registerSW\.js|manifest\.webmanifest|landing-render\.js)$/.test(file)));
for (const file of files.filter((file) => file.endsWith(".js"))) {
  assert.doesNotMatch(await readFile(resolve(root, file), "utf8"), /\/api\/(?:admin|auth)\/|renderToString|node:fs/);
}
console.log(`Verified 3 complete pages, 404, metadata, internal links, assets and isolated public bundle. Indexing: ${indexable}.`);
