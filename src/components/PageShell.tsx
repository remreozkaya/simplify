import type { ReactNode } from "react";

export default function PageShell({
  title,
  children,
  description,
}: {
  title: string;
  children: ReactNode;
  description?: string;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-w-0 flex-1 bg-slate-100 px-4 py-6 sm:py-8 dark:bg-slate-950 sm:px-6"
    >
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            {title}
          </h1>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
        </header>
        {children}
      </div>
    </main>
  );
}
