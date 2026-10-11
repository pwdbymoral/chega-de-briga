import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
assert.equal(scripts.length, 2, "O manual deve ter os scripts de tema e interação");

const taskMarkup = [...html.matchAll(/<article class="task-card">([\s\S]*?)<\/article>/g)].map((match) => match[1]);
assert.equal(taskMarkup.length, 2, "O manual deve mostrar dois estados de tarefa");
assert.match(taskMarkup[0], /<button class="demo-button primary-button task-complete"[^>]*>[\s\S]*?Concluir<\/button>/);
assert.match(taskMarkup[1], /class="status status-success"[\s\S]*?Concluída/);
assert.match(html, /Concluir é uma ação principal com rótulo/);
assert.match(html, /class="demo-icon-button"[^>]*aria-label="Fechar"/);

function renderScenario(savedTheme, prefersDark) {
  const root = { dataset: {} };
  const label = { textContent: "" };
  const glyph = { href: "", setAttribute(name, value) { this[name] = value; } };
  const sectionMenu = { open: true, addEventListener(type, listener) { this[type] = listener; } };
  const toggle = {
    querySelector(selector) { return selector === ".theme-label" ? label : glyph; },
    addEventListener(type, listener) { this[type] = listener; },
  };
  let storedTheme = savedTheme;
  const context = {
    document: {
      documentElement: root,
      getElementById() { return toggle; },
      querySelector(selector) { return selector === ".section-menu" ? sectionMenu : null; },
      querySelectorAll() { return []; },
    },
    localStorage: { getItem() { return storedTheme; }, setItem(_key, value) { storedTheme = value; } },
    matchMedia(query) {
      return query.startsWith("(max-width")
        ? { matches: false, addEventListener() {} }
        : { matches: prefersDark };
    },
  };
  for (const script of scripts) runInNewContext(script, context);
  return { root, toggle, label, glyph, get storedTheme() { return storedTheme; } };
}

const light = renderScenario(null, false);
assert.equal(light.root.dataset.theme, "light");
assert.equal(light.label.textContent, "Modo escuro");
assert.equal(light.glyph.href, "#icon-moon");
light.toggle.click();
assert.equal(light.root.dataset.theme, "dark");
assert.equal(light.storedTheme, "dark");
assert.equal(light.label.textContent, "Modo claro");
assert.equal(light.glyph.href, "#icon-sun");
assert.equal(renderScenario(null, true).root.dataset.theme, "dark");
assert.equal(renderScenario("light", true).root.dataset.theme, "light");
const dark = renderScenario("dark", false);
assert.equal(dark.root.dataset.theme, "dark");
dark.toggle.click();
assert.equal(dark.root.dataset.theme, "light");
assert.equal(dark.storedTheme, "light");
console.log("Interações verificadas: tema claro/escuro, preferência salva, botão de conclusão, estado e IconButton do manual.");
