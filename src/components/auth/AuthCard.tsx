import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

type AuthCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export default function AuthCard({
  title,
  description,
  children,
}: AuthCardProps) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-100 px-4 py-10 sm:px-6 dark:bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-30"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 50% 10%, rgba(37,99,235,.12), transparent 35%), radial-gradient(circle at 10% 90%, rgba(124,58,237,.08), transparent 30%)",
        }}
      />
      <div className="relative w-full max-w-[440px]">
        <div className="mb-6 flex items-center justify-between px-1">
          <Link
            href="/login"
            className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-950 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-white"
            aria-label="Simplify authentication home"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-sm text-white shadow-sm shadow-blue-600/25">
              S
            </span>
            Simplify
          </Link>
          <ThemeToggle />
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/[.06] sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
          <header className="mb-7">
            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {description}
              </p>
            ) : null}
          </header>
          {children}
        </section>

        <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
          Your university life, organized.
        </p>
      </div>
    </main>
  );
}
