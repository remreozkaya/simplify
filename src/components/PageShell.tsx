import type { ReactNode } from "react";

export default function PageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-slate-100 px-4 py-8 dark:bg-slate-950 sm:px-6"
    >
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            {title}
          </h1>
        </header>
        {children}
      </div>
    </main>
  );
}
