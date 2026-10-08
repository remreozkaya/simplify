"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  applyLanguagePreference,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  resolveLanguage,
  translate,
  validLanguage,
  type Language,
} from "@/lib/i18n";

const LANGUAGE_CHANGE_EVENT = "simplify-language-change";

function currentLanguage(): Language {
  const value = document.documentElement.lang;
  return validLanguage(value) ? value : DEFAULT_LANGUAGE;
}

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== LANGUAGE_STORAGE_KEY && event.key !== null) return;
    try {
      if (event.storageArea !== window.localStorage) return;
    } catch {
      return;
    }
    // Storage events do not run the other tab's applyLanguage call. Update
    // the snapshot source before notifying React, without writing it back.
    applyLanguagePreference(resolveLanguage(event.newValue), document.documentElement);
    callback();
  };
  window.addEventListener(LANGUAGE_CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function applyLanguage(language: Language) {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    /* Storage may be blocked. */
  }
  applyLanguagePreference(language, document.documentElement, storage);
  window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
}

export function useLanguage() {
  const language = useSyncExternalStore(
    subscribe,
    currentLanguage,
    () => DEFAULT_LANGUAGE,
  );
  const t = useCallback(
    (key: string, parameters?: Record<string, string | number>) =>
      translate(language, key, parameters),
    [language],
  );
  return { language, t, setLanguage: applyLanguage };
}
