import type { ReactNode } from "react";

export default function PageShell({
  title,
  children,
  description,
  header,
  home = false,
}: {
  title: string;
  children: ReactNode;
  description?: string;
  header?: ReactNode;
  home?: boolean;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-w-0 flex-1 bg-white px-4 py-8 sm:py-12 dark:bg-slate-950 sm:px-6"
    >
      <div className={`mx-auto ${home ? "max-w-[1120px]" : "max-w-[1440px]"}`}>
        {header ?? <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {title}
          </h1>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
        </header>}
        {children}
      </div>
    </main>
  );
}
