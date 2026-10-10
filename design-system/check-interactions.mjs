import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
assert.equal(scripts.length, 2, "O manual deve ter os scripts de tema e interação");

const taskMarkup = [...html.matchAll(/<label class="task-card">([\s\S]*?)<\/label>/g)].map((match) => match[1]);
assert.equal(taskMarkup.length, 2, "O manual deve mostrar dois estados de tarefa");

function makeCard(markup) {
  const statusMarkup = markup.match(/<small data-pending="([^"]+)" data-done="([^"]+)"[^>]*>([^<]*)<\/small>/);
  assert.ok(statusMarkup, "Cada tarefa deve declarar os dois estados em texto");
  const checkbox = { checked: /<input[^>]*\bchecked\b/.test(markup), addEventListener(type, listener) { this[type] = listener; } };
  const status = { dataset: { pending: statusMarkup[1], done: statusMarkup[2] }, textContent: statusMarkup[3] };
  return { checkbox, status, querySelector(selector) { return selector.startsWith("input") ? checkbox : status; } };
}

function renderScenario(savedTheme, prefersDark) {
  const cards = taskMarkup.map(makeCard);
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
      querySelectorAll() { return cards; },
    },
    localStorage: { getItem() { return storedTheme; }, setItem(_key, value) { storedTheme = value; } },
    matchMedia(query) {
      return query.startsWith("(max-width")
        ? { matches: false, addEventListener() {} }
        : { matches: prefersDark };
    },
  };
  for (const script of scripts) runInNewContext(script, context);
  return { cards, root, toggle, label, glyph, get storedTheme() { return storedTheme; } };
}

const light = renderScenario(null, false);
assert.equal(light.root.dataset.theme, "light");
assert.equal(light.label.textContent, "Modo escuro");
assert.equal(light.glyph.href, "#icon-moon");
assert.equal(light.cards[0].status.textContent, "Hoje, até 19h · Júlia");
assert.equal(light.cards[1].status.textContent, "Concluída · Caio");
light.toggle.click();
assert.equal(light.root.dataset.theme, "dark");
assert.equal(light.storedTheme, "dark");
assert.equal(light.label.textContent, "Modo claro");
assert.equal(light.glyph.href, "#icon-sun");
light.cards[0].checkbox.checked = true;
light.cards[0].checkbox.change();
assert.equal(light.cards[0].status.textContent, "Concluída · Júlia");
light.cards[1].checkbox.checked = false;
light.cards[1].checkbox.change();
assert.equal(light.cards[1].status.textContent, "Hoje, até 19h · Caio");

assert.equal(renderScenario(null, true).root.dataset.theme, "dark");
assert.equal(renderScenario("light", true).root.dataset.theme, "light");
const dark = renderScenario("dark", false);
assert.equal(dark.root.dataset.theme, "dark");
dark.toggle.click();
assert.equal(dark.root.dataset.theme, "light");
assert.equal(dark.storedTheme, "light");
console.log("Interações verificadas: tema claro/escuro, preferência salva e estados das tarefas.");
