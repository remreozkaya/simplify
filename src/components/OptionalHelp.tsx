import type { ReactNode } from "react";

export default function OptionalHelp({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="mt-3 text-sm text-slate-600 dark:text-slate-300">
      <summary className="w-fit cursor-pointer rounded font-medium hover:text-blue-700 dark:hover:text-blue-300">
        {summary}
      </summary>
      <div className="mt-2 max-w-3xl space-y-2 leading-6">{children}</div>
    </details>
  );
}
