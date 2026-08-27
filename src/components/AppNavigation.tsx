import Link from "next/link";

export default function AppNavigation() {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur" aria-label="Primary navigation">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-black tracking-tight text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
          Simplify
        </Link>
        <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-slate-600">
          <Link href="/#weekly-planner" className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-blue-600">
            Weekly Planner
          </Link>
          <Link href="/#schedule-generator" className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-blue-600">
            Schedule Generator
          </Link>
          <Link href="/curriculum" className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-blue-600">
            Curriculum
          </Link>
        </div>
      </div>
    </nav>
  );
}
