import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  applyLanguagePreference,
  DEFAULT_LANGUAGE,
  formatDate,
  formatNumber,
  LANGUAGE_STORAGE_KEY,
  localizedAcademicName,
  offeringDisplayName,
  resolveLanguage,
  translate,
} from "@/lib/i18n";
import { translations } from "@/lib/i18n/translations";

function keys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    keys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe("Turkish and English localization", () => {
  it("uses Turkish by default without replacing a valid saved preference", () => {
    expect(DEFAULT_LANGUAGE).toBe("tr");
    expect(resolveLanguage(undefined)).toBe("tr");
    expect(resolveLanguage("en")).toBe("en");
    expect(resolveLanguage("tr")).toBe("tr");
  });

  it("persists language and updates document language independently of theme", () => {
    const root = { lang: "tr", className: "dark" };
    const saved = new Map<string, string>([["simplify-theme", "dark"]]);
    applyLanguagePreference("en", root, {
      setItem: (key, value) => saved.set(key, value),
    });
    expect(root).toEqual({ lang: "en", className: "dark" });
    expect(saved.get(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(saved.get("simplify-theme")).toBe("dark");
  });

  it("keeps translation namespaces complete in both languages", () => {
    expect(keys(translations.tr).sort()).toEqual(keys(translations.en).sort());
    expect(translate("tr", "navigation.curriculum")).toBe("Müfredat");
    expect(translate("en", "academicPrograms.doubleMajor")).toBe(
      "Double Major",
    );
  });

  it("resolves translation keys referenced by the interface", () => {
    const knownKeys = new Set(keys(translations.tr));
    const namespaces = new Set(Object.keys(translations.tr));
    const missing: string[] = [];
    function visitDirectory(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) visitDirectory(path);
        else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
          const source = ts.createSourceFile(
            path,
            readFileSync(path, "utf8"),
            ts.ScriptTarget.Latest,
            true,
          );
          function visit(node: ts.Node) {
            if (
              ts.isStringLiteral(node) &&
              namespaces.has(node.text.split(".")[0]) &&
              node.text.includes(".") &&
              !knownKeys.has(node.text)
            ) {
              missing.push(`${path}: ${node.text}`);
            }
            ts.forEachChild(node, visit);
          }
          visit(source);
        }
      }
    }
    visitDirectory(join(process.cwd(), "src/app"));
    visitDirectory(join(process.cwd(), "src/components"));
    visitDirectory(join(process.cwd(), "src/lib"));
    expect(missing).toEqual([]);
  });

  it("formats decimals and dates by locale without changing their values", () => {
    expect(formatNumber("tr", 3.5, { minimumFractionDigits: 2 })).toBe("3,50");
    expect(formatNumber("en", 3.5, { minimumFractionDigits: 2 })).toBe("3.50");
    expect(formatDate("tr", "2026-09-03T00:00:00Z", { timeZone: "UTC" })).toBe(
      "03.09.2026",
    );
  });

  it("uses the official academic-name fallback chain and typed suffixes", () => {
    expect(
      localizedAcademicName(
        { nameTr: "Ekonomi", nameEn: "Economics", code: "ECN" },
        "en",
      ),
    ).toBe("Economics");
    expect(
      localizedAcademicName({ nameTr: "Ekonomi", code: "ECN" }, "en"),
    ).toBe("Ekonomi");
    expect(localizedAcademicName({ code: "ECN" }, "tr")).toBe("ECN");
    expect(
      offeringDisplayName(
        {
          nameTr: "Ekonomi (İngilizce) Lisans",
          nameEn: "Economics (English)",
          planType: "cap",
        },
        "en",
      ),
    ).toBe("Economics (English) – Double Major");
    expect(
      offeringDisplayName(
        { nameTr: "Ekonomi (Yandal)", planType: "yandal" },
        "tr",
      ),
    ).toBe("Ekonomi – Yandal");
  });
});
