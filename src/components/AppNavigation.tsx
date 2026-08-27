"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import ThemeToggle from "@/components/ThemeToggle";

const links = [
  { href: "/", label: "Weekly Planner" },
  { href: "/generator", label: "Schedule Generator" },
  { href: "/curriculum", label: "Curriculum" },
];

export default function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="app-navigation sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur" aria-label="Primary navigation">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
          <span className="grid size-8 place-items-center rounded-xl bg-blue-600 text-sm text-white shadow-sm">S</span>
          Simplify
        </Link>
        <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-slate-600">
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
        </div>
      </div>
    </nav>
  );
}
