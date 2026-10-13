import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const { JSDOM } = createRequire(new URL("../apps/web/package.json", import.meta.url))("jsdom");
const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
assert.equal(scripts.length, 2, "O manual deve ter os scripts de tema e interação");

function renderScenario(savedTheme, prefersDark) {
  const { window } = new JSDOM(html, { url: "https://manual.example.test", runScripts: "outside-only" });
  const system = new window.EventTarget();
  system.matches = prefersDark;
  window.matchMedia = (query) => query.startsWith("(max-width") ? { matches: false, addEventListener() {} } : system;
  if (savedTheme) window.localStorage.setItem("cdb-theme", savedTheme);
  scripts.forEach((script) => window.eval(script));
  const document = window.document;
  const toggle = document.getElementById("theme-toggle");
  const menu = document.getElementById("theme-options");
  const option = (value) => menu.querySelector(`[data-theme-value="${value}"]`);
  return { window, document, root: document.documentElement, toggle, menu, option, system };
}

const light = renderScenario(null, false);
assert.equal(light.root.dataset.theme, "light");
assert.equal(light.toggle.textContent.trim(), "Tema: Sistema");
light.toggle.click();
assert.equal(light.menu.hidden, false);
assert.equal(light.document.activeElement, light.option("system"));
light.option("dark").click();
assert.equal(light.root.dataset.theme, "dark");
assert.equal(light.window.localStorage.getItem("cdb-theme"), "dark");
assert.equal(light.toggle.getAttribute("aria-label"), "Tema: Escuro");
assert.equal(light.option("dark").getAttribute("aria-selected"), "true");
assert.equal(light.menu.hidden, true);
assert.equal(light.document.activeElement, light.toggle);
light.toggle.click();
light.option("dark").dispatchEvent(new light.window.KeyboardEvent("keydown", { key: "Home", bubbles: true }));
assert.equal(light.document.activeElement, light.option("system"));
light.option("system").dispatchEvent(new light.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
assert.equal(light.menu.hidden, true);
assert.equal(light.document.activeElement, light.toggle);
light.toggle.click();
light.document.body.dispatchEvent(new light.window.Event("pointerdown", { bubbles: true }));
assert.equal(light.menu.hidden, true);
light.toggle.click();
light.option("system").click();
assert.equal(light.window.localStorage.getItem("cdb-theme"), null);
light.system.matches = true;
light.system.dispatchEvent(new light.window.Event("change"));
assert.equal(light.root.dataset.theme, "dark");
light.window.localStorage.setItem("cdb-theme", "light");
light.window.dispatchEvent(new light.window.StorageEvent("storage", { key: "cdb-theme" }));
assert.equal(light.root.dataset.theme, "light");
assert.equal(light.toggle.getAttribute("aria-label"), "Tema: Claro");
light.system.dispatchEvent(new light.window.Event("change"));
assert.equal(light.root.dataset.theme, "light", "Preferência explícita não segue o sistema");
for (const [saved, system, expected] of [[null, true, "dark"], ["light", true, "light"], ["dark", false, "dark"]]) {
  const scenario = renderScenario(saved, system);
  assert.equal(scenario.root.dataset.theme, expected);
  scenario.window.close();
}
assert.equal(light.document.querySelectorAll(".task-card").length, 2);
assert.equal(light.document.querySelector(".task-complete").textContent.trim(), "Concluir");
assert.match(light.document.querySelector(".task-card .status").textContent, /Concluída/);
assert.equal(light.document.querySelectorAll(".action-specimen").length, 5);
assert.ok(light.document.querySelector(".card-actions button:disabled"));
assert.ok(light.document.querySelector('.demo-icon-button[aria-label="Fechar"]'));
light.window.close();
console.log("Manual verificado: agrupamentos, três preferências de tema, persistência, sistema, abas e teclado.");
