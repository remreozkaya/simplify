"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/auth/actions";
import ThemeToggle from "@/components/ThemeToggle";

const links = [
  { href: "/", label: "Weekly Planner" },
  { href: "/generator", label: "Schedule Generator" },
  { href: "/curriculum", label: "Curriculum" },
];

export default function AppNavigation({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <nav className="app-navigation sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur" aria-label="Primary navigation">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
          <span className="grid size-8 place-items-center rounded-xl bg-blue-600 text-sm text-white shadow-sm">S</span>
          Simplify
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-1 text-sm font-semibold text-slate-600">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-xl px-3 py-2 transition ${active ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-100 hover:text-slate-950"}`}
              >
                {link.label}
              </Link>
            );
          })}
          <ThemeToggle />
          <div className="ml-1 flex max-w-full items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-700">
            <span
              className="hidden max-w-44 truncate text-xs font-semibold text-slate-500 md:block dark:text-slate-400"
              title={email}
            >
              {email}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}
