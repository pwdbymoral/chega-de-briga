import { afterEach, describe, expect, it } from "vitest";
import { readThemePreference, resolveTheme } from "./theme";

afterEach(() => localStorage.removeItem("cdb-theme"));

describe("preferência de tema", () => {
  it("usa o sistema quando não há escolha salva", () => {
    expect(readThemePreference()).toBe("system");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("respeita uma escolha explícita", () => {
    localStorage.setItem("cdb-theme", "light");
    expect(readThemePreference()).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });
});
