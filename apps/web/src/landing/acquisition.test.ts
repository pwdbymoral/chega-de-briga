import { afterEach, describe, expect, it } from "vitest";
import { activeAcquisition, attributionLifetime, resolveAcquisition as resolveContext } from "./acquisition";

const resolveAcquisition = (...args: Parameters<typeof resolveContext>) => resolveContext(...args).acquisition;
const base = "https://chegadebriga.forjacorp.com";
afterEach(() => sessionStorage.clear());

describe("atribuição sem identificação de visitante", () => {
  it.each([
    ["https://www.google.com/search?q=private", "google"],
    ["https://www.google.com.br/", "google"],
    ["https://gemini.google.com/app", "gemini"],
    ["https://chatgpt.com/c/private", "chatgpt"],
    ["https://chat.openai.com/", "chatgpt"],
    ["https://www.bing.com/", "bing"],
    ["https://www.perplexity.ai/", "perplexity"],
    ["https://copilot.microsoft.com/", "copilot"],
    ["https://claude.ai/", "claude"],
    ["https://google.com.evil.test/", "other_referral"],
    ["https://notgoogle.com/", "other_referral"],
    ["", "direct_unknown"],
  ])("classifica %s sem gravar referência", (referrer, source) => {
    expect(resolveAcquisition(base, referrer)).toEqual({ source });
  });

  it("prioritizes recognized UTM, then referrer, and ignores unknown parameters", () => {
    expect(resolveAcquisition(`${base}/?utm_source=chatgpt.com&utm_campaign=guia&email=ana@example.test`, "https://google.com/")).toEqual({ source: "chatgpt", utm_source: "chatgpt.com", utm_campaign: "guia" });
    expect(resolveAcquisition(`${base}/?utm_medium=organic`, "https://bing.com/").source).toBe("bing");
    expect(resolveAcquisition(`${base}/?utm_source=constructor`, "").source).toBe("other_campaign");
    expect(resolveAcquisition(`${base}/?utm_source=ana%40example.test`, "")).toEqual({ source: "direct_unknown" });
  });

  it("preserves source from guide to landing without renewing the 30 minute limit", () => {
    const first = resolveAcquisition(`${base}/guias/dividir-tarefas-domesticas/?utm_source=chatgpt`, "", sessionStorage, 100);
    const saved = sessionStorage.getItem("cdb-acquisition");
    expect(resolveAcquisition(base, `${base}/guias/dividir-tarefas-domesticas/`, sessionStorage, 200)).toEqual(first);
    expect(sessionStorage.getItem("cdb-acquisition")).toBe(saved);
    expect(resolveAcquisition(base, base, sessionStorage, 100 + attributionLifetime)).toEqual({ source: "direct_unknown" });
  });

  it("expires attribution even when the form remains open", () => {
    const context = resolveContext(`${base}/?utm_source=chatgpt`, "", sessionStorage, 100);
    expect(activeAcquisition(context, 100 + attributionLifetime - 1)).toEqual({ source: "chatgpt", utm_source: "chatgpt" });
    expect(activeAcquisition(context, 100 + attributionLifetime)).toEqual({ source: "direct_unknown" });
  });

  it("replaces old context on new external traffic or a campaign", () => {
    resolveAcquisition(base, "https://google.com/", sessionStorage, 100);
    expect(resolveAcquisition(base, "https://claude.ai/", sessionStorage, 200).source).toBe("claude");
    expect(resolveAcquisition(`${base}/?utm_source=newsletter`, base, sessionStorage, 300).source).toBe("other_campaign");
  });

  it("fails safely with blocked, corrupt or expired storage", () => {
    const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
    expect(resolveAcquisition(base, "https://chatgpt.com/", blocked)).toEqual({ source: "chatgpt" });
    sessionStorage.setItem("cdb-acquisition", "bad json");
    expect(resolveAcquisition(base, "", sessionStorage, 100).source).toBe("direct_unknown");
    sessionStorage.setItem("cdb-acquisition", JSON.stringify({ source: "google", expiresAt: 100 + attributionLifetime + 1, secret: "private" }));
    expect(resolveAcquisition(base, "", sessionStorage, 100).source).toBe("direct_unknown");
    const saved = JSON.parse(sessionStorage.getItem("cdb-acquisition")!);
    expect(Object.keys(saved).sort()).toEqual(["expiresAt", "source"]);
  });
});
