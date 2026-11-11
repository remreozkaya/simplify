import type { ReactNode } from "react";

export default function PageShell({
  title,
  children,
  description,
  header,
  home = false,
  reading = false,
}: {
  title: string;
  children: ReactNode;
  description?: string;
  header?: ReactNode;
  home?: boolean;
  reading?: boolean;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="page-shell min-w-0 flex-1 bg-slate-50 px-4 py-7 sm:py-10 dark:bg-slate-950 sm:px-6 lg:px-8"
    >
      <div className={`mx-auto ${reading ? "max-w-3xl" : home ? "max-w-[1120px]" : "max-w-[1440px]"}`}>
        {header ?? <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            {title}
          </h1>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
        </header>}
        {children}
      </div>
    </main>
  );
}
