"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n/client";
import { applyLocalizedMetadata } from "@/lib/i18n/metadata";

export default function LocalizedMetadata() {
  const pathname = usePathname();
  const { language } = useLanguage();
  useEffect(() => {
    const apply = () => applyLocalizedMetadata(language, document);
    apply();
    // Next can commit server metadata after hydration/navigation. Keep the
    // browser preference authoritative; conditional writes prevent loops.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["content"],
    });
    return () => observer.disconnect();
  }, [language, pathname]);
  return null;
}
