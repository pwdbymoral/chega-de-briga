import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import StyleDictionary from "style-dictionary";

const source = fileURLToPath(new URL("./tokens/source.json", import.meta.url));
const outputCss = fileURLToPath(new URL("./generated/tokens.css", import.meta.url));
const outputNative = fileURLToPath(new URL("./generated/tokens.native.ts", import.meta.url));
const dictionary = await new StyleDictionary({ source: [source], platforms: { shared: {} } }).getPlatformTokens("shared");
const tokens = dictionary.allTokens;
const byGroup = (group) => tokens.filter((token) => token.path[0] === group);
const cssName = (token) => `--${token.path.filter((part) => part !== "light" && part !== "dark").join("-")}`;

function cssValue(token) {
  if (token.$type === "dimension" && token.path.join(".") !== "radius.pill") {
    assert.match(token.$value, /^\d+px$/, `Dimensão inválida: ${token.path.join(".")}`);
    return `${Number.parseInt(token.$value, 10) / 16}rem`;
  }
  return token.$value;
}

const lines = (items) => items.map((token) => `  ${cssName(token)}: ${cssValue(token)};`).join("\n");
const common = tokens.filter((token) => token.path[0] !== "color");
const light = byGroup("color").filter((token) => token.path[1] === "light");
const dark = byGroup("color").filter((token) => token.path[1] === "dark");
assert.equal(light.length, dark.length, "Os temas precisam ter os mesmos papéis semânticos");
assert.deepEqual(light.map((token) => token.path[2]), dark.map((token) => token.path[2]));

const css = `/* Gerado de tokens/source.json. Edite a fonte e execute pnpm tokens:build. */\n:root {\n  color-scheme: light;\n${lines([...common, ...light])}\n}\n\n:root[data-theme="dark"] {\n  color-scheme: dark;\n${lines(dark)}\n}\n`;
const native = { brand: {}, color: { light: {}, dark: {} }, type: {}, space: {}, radius: {}, motion: {} };
for (const token of tokens) {
  const value = /^(dimension|duration)$/.test(token.$type)
    ? Number.parseInt(token.$value, 10)
    : token.$value;
  assert.ok(value !== undefined && !Number.isNaN(value), `Token inválido: ${token.path.join(".")}`);
  if (token.path.length === 1) native[token.path[0]] = value;
  else if (token.path[0] === "color") native.color[token.path[1]][token.path[2]] = value;
  else native[token.path[0]][token.path[1]] = value;
}
const nativeTs = `// Gerado de tokens/source.json. Edite a fonte e execute pnpm tokens:build.\nexport const tokens = ${JSON.stringify(native, null, 2)} as const;\n\nexport type Theme = keyof typeof tokens.color;\n`;

for (const [path, content] of [[outputCss, css], [outputNative, nativeTs]]) {
  if (process.argv.includes("--check")) {
    assert.equal(await readFile(path, "utf8"), content, `${path} está desatualizado. Execute pnpm tokens:build.`);
  } else {
    await mkdir(fileURLToPath(new URL("./generated/", import.meta.url)), { recursive: true });
    await writeFile(path, content);
  }
}
console.log(process.argv.includes("--check") ? "Tokens sincronizados." : "Tokens CSS e TypeScript gerados.");
