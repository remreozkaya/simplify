import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  changed: vi.fn(),
  unsubscribe: undefined as (() => void) | undefined,
}));

// No DOM renderer is installed. Capture the real external-store subscription
// and drive browser events through EventTarget rather than simulating React UI.
vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: (
    subscribe: (callback: () => void) => () => void,
    getSnapshot: () => string,
  ) => {
    store.unsubscribe = subscribe(store.changed);
    return getSnapshot();
  },
}));

import { applyLanguage, useLanguage } from "@/lib/i18n/client";
import { LANGUAGE_STORAGE_KEY } from "@/lib/i18n";

let root: { lang: string; className: string };
let browser: EventTarget & { localStorage: { setItem: ReturnType<typeof vi.fn> } };

function storageEvent(key: string | null, newValue: string | null, storageArea: unknown = browser.localStorage) {
  browser.dispatchEvent(Object.assign(new Event("storage"), {
    key, newValue, storageArea,
  }));
}

beforeEach(() => {
  root = { lang: "tr", className: "dark" };
  browser = Object.assign(new EventTarget(), { localStorage: { setItem: vi.fn() } });
  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal("window", browser);
  store.changed.mockReset();
});

afterEach(() => {
  store.unsubscribe?.();
  vi.unstubAllGlobals();
});

describe("browser language subscription", () => {
  it("applies another tab's language before notifying rendered subscribers", () => {
    useLanguage();
    const snapshots: string[] = [];
    store.changed.mockImplementation(() => snapshots.push(root.lang));
    storageEvent(LANGUAGE_STORAGE_KEY, "en");
    expect(root.lang).toBe("en");
    expect(snapshots).toEqual(["en"]);
    expect(root.className).toBe("dark");
    expect(store.changed).toHaveBeenCalledOnce();
    expect(browser.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("restores Turkish for invalid, removed and cleared preferences", () => {
    useLanguage();
    for (const [key, value] of [[LANGUAGE_STORAGE_KEY, "de"], [LANGUAGE_STORAGE_KEY, null], [null, null]] as const) {
      root.lang = "en";
      storageEvent(key, value);
      expect(root.lang).toBe("tr");
    }
  });

  it("ignores unrelated browser keys and session-storage events", () => {
    useLanguage();
    storageEvent("simplify-theme", "light");
    storageEvent(LANGUAGE_STORAGE_KEY, "en", {});
    expect(root.lang).toBe("tr");
    expect(store.changed).not.toHaveBeenCalled();
  });

  it("switches the current tab when storage access is blocked", () => {
    useLanguage();
    Object.defineProperty(browser, "localStorage", { get() { throw new Error("blocked"); } });
    applyLanguage("en");
    expect(root.lang).toBe("en");
    expect(store.changed).toHaveBeenCalledOnce();
  });

  it("unsubscribes browser listeners", () => {
    useLanguage();
    store.unsubscribe?.();
    storageEvent(LANGUAGE_STORAGE_KEY, "en");
    expect(root.lang).toBe("tr");
    expect(store.changed).not.toHaveBeenCalled();
  });
});
