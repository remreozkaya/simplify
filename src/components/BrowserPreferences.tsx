"use client";

import { useEffect } from "react";
import { applyLanguage } from "@/lib/i18n/client";

export default function BrowserPreferences() {
  useEffect(() => {
    // Next's streamed error fallback can replace the document attributes after
    // the inline bootstrap has run. Reconcile saved preferences on hydration.
    try {
      const language = localStorage.getItem("simplify-language") === "en" ? "en" : "tr";
      if (document.documentElement.lang !== language) applyLanguage(language);

      const savedTheme = localStorage.getItem("simplify-theme");
      const dark = savedTheme === "dark" || (savedTheme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      if (document.documentElement.classList.contains("dark") !== dark) {
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.style.colorScheme = dark ? "dark" : "light";
        window.dispatchEvent(new Event("simplify-theme-change"));
      }
    } catch {
      // The server defaults remain usable when browser storage is unavailable.
    }
  }, []);

  return null;
}
