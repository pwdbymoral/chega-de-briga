import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve("dist-landing");
const port = Number(process.env.LANDING_PREVIEW_PORT ?? 4174);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".xml": "application/xml", ".txt": "text/plain", ".woff2": "font/woff2" };
createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405).end(); return; }
  try {
    const url = new URL(request.url, "http://localhost");
    let file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(400).end(); return; }
    let status = 200;
    try {
      if ((await stat(file)).isDirectory()) {
        if (!url.pathname.endsWith("/")) { response.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end(); return; }
        file = resolve(file, "index.html");
      }
      await stat(file);
    } catch { file = resolve(root, "404.html"); status = 404; }
    const body = await readFile(file);
    response.writeHead(status, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch { response.writeHead(400).end(); }
}).listen(port, "127.0.0.1", () => console.log(`Landing preview: http://127.0.0.1:${port}`));
