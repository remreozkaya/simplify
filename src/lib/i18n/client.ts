"use client";

import { useCallback, useSyncExternalStore } from "react";

import { applyLanguagePreference, DEFAULT_LANGUAGE, translate, validLanguage, type Language } from "@/lib/i18n";

const LANGUAGE_CHANGE_EVENT = "simplify-language-change";

function currentLanguage(): Language {
  const value = document.documentElement.lang;
  return validLanguage(value) ? value : DEFAULT_LANGUAGE;
}

function subscribe(callback: () => void) {
  window.addEventListener(LANGUAGE_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function applyLanguage(language: Language) {
  applyLanguagePreference(language, document.documentElement, localStorage);
  window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
}

export function useLanguage() {
  const language = useSyncExternalStore(subscribe, currentLanguage, () => DEFAULT_LANGUAGE);
  const t = useCallback((key: string, parameters?: Record<string, string | number>) => translate(language, key, parameters), [language]);
  return { language, t, setLanguage: applyLanguage };
}
