"use client";

import { useEffect, useRef } from "react";

export function useAuthForm() {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    // Resolved validation actions reset forms during React's commit phase,
    // when synthetic events are disabled. Keep inputs until navigation.
    const preserveInputs = (event: Event) => event.preventDefault();
    form.addEventListener("reset", preserveInputs);
    return () => form.removeEventListener("reset", preserveInputs);
  }, []);

  return formRef;
}
