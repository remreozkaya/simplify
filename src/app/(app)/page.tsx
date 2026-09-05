"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/client";

type Feature = {
  href: string;
  titleKey: string;
  descriptionKey: string;
  eyebrowKey: string;
  accent: keyof typeof accentClasses;
  preview: "semester" | "planner" | "generator" | "curriculum" | "graduation";
};

const accentClasses = {
  blue: {
    label: "text-blue-700 dark:text-blue-300",
    arrow: "bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950 dark:text-blue-300 dark:group-hover:bg-blue-500 dark:group-hover:text-white",
    glow: "from-blue-500/20 via-cyan-400/10 to-transparent",
  },
  violet: {
    label: "text-violet-700 dark:text-violet-300",
    arrow: "bg-violet-50 text-violet-700 group-hover:bg-violet-600 group-hover:text-white dark:bg-violet-950 dark:text-violet-300 dark:group-hover:bg-violet-500 dark:group-hover:text-white",
    glow: "from-violet-500/20 via-fuchsia-400/10 to-transparent",
  },
  cyan: {
    label: "text-cyan-700 dark:text-cyan-300",
    arrow: "bg-cyan-50 text-cyan-700 group-hover:bg-cyan-600 group-hover:text-white dark:bg-cyan-950 dark:text-cyan-300 dark:group-hover:bg-cyan-500 dark:group-hover:text-white",
    glow: "from-cyan-500/20 via-sky-400/10 to-transparent",
  },
  emerald: {
    label: "text-emerald-700 dark:text-emerald-300",
    arrow: "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950 dark:text-emerald-300 dark:group-hover:bg-emerald-500 dark:group-hover:text-white",
    glow: "from-emerald-500/20 via-teal-400/10 to-transparent",
  },
  amber: {
    label: "text-amber-700 dark:text-amber-300",
    arrow: "bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white dark:bg-amber-950 dark:text-amber-300 dark:group-hover:bg-amber-500 dark:group-hover:text-white",
    glow: "from-amber-500/20 via-orange-400/10 to-transparent",
  },
} as const;

const features: Feature[] = [
  {
    href: "/semester-planner",
    titleKey: "navigation.semesterPlanner", descriptionKey: "home.semesterDescription", eyebrowKey: "home.semesterEyebrow",
    accent: "amber",
    preview: "semester",
  },
  {
    href: "/weekly-planner",
    titleKey: "navigation.weeklyPlanner", descriptionKey: "home.plannerDescription", eyebrowKey: "home.plannerEyebrow",
    accent: "blue",
    preview: "planner",
  },
  {
    href: "/generator",
    titleKey: "navigation.scheduleGenerator", descriptionKey: "home.generatorDescription", eyebrowKey: "home.generatorEyebrow",
    accent: "violet",
    preview: "generator",
  },
  {
    href: "/curriculum",
    titleKey: "navigation.curriculum", descriptionKey: "home.curriculumDescription", eyebrowKey: "home.curriculumEyebrow",
    accent: "cyan",
    preview: "curriculum",
  },
  {
    href: "/graduation-calculator",
    titleKey: "navigation.graduationCalculator", descriptionKey: "home.graduationDescription", eyebrowKey: "home.graduationEyebrow",
    accent: "emerald",
    preview: "graduation",
  },
];

function PlannerPreview() {
  const blocks = [
    "col-start-2 row-start-1 row-span-2 bg-blue-500",
    "col-start-3 row-start-2 row-span-2 bg-cyan-400",
    "col-start-4 row-start-1 bg-indigo-400",
    "col-start-5 row-start-3 row-span-2 bg-blue-400",
  ];

  return (
    <div className="grid h-full grid-cols-[28px_repeat(5,1fr)] grid-rows-[repeat(4,1fr)] gap-1.5 p-4 sm:p-5">
      <div className="row-span-4 flex flex-col justify-around text-[7px] font-bold text-slate-400">
        <span>09</span><span>11</span><span>13</span><span>15</span>
      </div>
      {Array.from({ length: 20 }, (_, index) => (
        <span key={index} className="rounded-md border border-slate-200/80 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80" />
      ))}
      {blocks.map((className) => (
        <span key={className} className={`z-10 rounded-md p-1 shadow-sm ${className}`}>
          <span className="block h-1 w-2/3 rounded-full bg-white/80" />
        </span>
      ))}
    </div>
  );
}

function GeneratorPreview() {
  return (
    <div className="flex h-full gap-3 p-4 sm:p-5">
      <div className="w-[38%] rounded-xl border border-slate-200 bg-white/90 p-2.5 dark:border-slate-700 dark:bg-slate-800/90">
        <span className="mb-2 block h-2 w-3/4 rounded-full bg-slate-300 dark:bg-slate-600" />
        {["bg-violet-500", "bg-fuchsia-400", "bg-indigo-400"].map((color) => (
          <span key={color} className="mb-1.5 flex items-center gap-1.5 rounded-md bg-slate-100 p-1.5 dark:bg-slate-700">
            <span className={`size-2 rounded-full ${color}`} />
            <span className="h-1.5 flex-1 rounded-full bg-slate-300 dark:bg-slate-500" />
          </span>
        ))}
        <span className="mt-3 block h-5 rounded-md bg-violet-600" />
      </div>
      <div className="grid flex-1 grid-cols-3 grid-rows-4 gap-1.5 rounded-xl border border-slate-200 bg-white/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/70">
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} className={`rounded ${index === 1 || index === 5 || index === 9 ? "bg-violet-400" : "bg-slate-100 dark:bg-slate-700"}`} />
        ))}
      </div>
    </div>
  );
}

function CurriculumPreview() {
  return (
    <div className="relative flex h-full items-center justify-center p-4 sm:p-5">
      <svg className="absolute inset-0 size-full text-cyan-300/70 dark:text-cyan-700/70" viewBox="0 0 320 160" fill="none" aria-hidden="true">
        <path d="M72 80H130M190 80H248M160 52V28M160 108V134M105 80L142 45M215 80L178 45M105 80L142 115M215 80L178 115" stroke="currentColor" strokeWidth="2" />
      </svg>
      {[
        "left-[8%] top-[38%]", "left-[39%] top-[8%]", "left-[39%] top-[39%]", "left-[39%] bottom-[8%]", "right-[8%] top-[38%]",
      ].map((position, index) => (
        <span key={position} className={`absolute ${position} z-10 flex h-9 w-16 items-center justify-center rounded-lg border bg-white shadow-sm dark:bg-slate-800 ${index === 2 ? "border-cyan-500" : "border-slate-200 dark:border-slate-700"}`}>
          <span className={`h-1.5 w-8 rounded-full ${index === 2 ? "bg-cyan-500" : "bg-slate-300 dark:bg-slate-600"}`} />
        </span>
      ))}
    </div>
  );
}

function GraduationPreview() {
  return (
    <div className="flex h-full items-center gap-5 p-4 sm:p-5">
      <div className="relative grid size-24 shrink-0 place-items-center rounded-full bg-[conic-gradient(#10b981_0_73%,#d1fae5_73%_100%)] dark:bg-[conic-gradient(#34d399_0_73%,#134e4a_73%_100%)]">
        <div className="grid size-[70px] place-items-center rounded-full bg-white text-center dark:bg-slate-800">
          <span className="text-xl font-black text-slate-900 dark:text-white">73%</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        {["w-full bg-emerald-500", "w-4/5 bg-emerald-400", "w-3/5 bg-amber-400"].map((width) => (
          <span key={width} className="block">
            <span className="mb-1 block h-1.5 w-1/2 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="block h-2.5 rounded-full bg-slate-200 dark:bg-slate-700">
              <span className={`block h-full rounded-full ${width}`} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SemesterPreview() {
  return (
    <div className="flex h-full gap-3 p-4 sm:p-5">
      <div className="flex w-1/3 flex-col justify-center gap-2">
        {["w-full", "w-4/5", "w-2/3"].map((width, index) => (
          <span key={width} className={`block rounded-lg border border-amber-200 bg-white p-2 shadow-sm dark:border-amber-900 dark:bg-slate-800 ${width}`}>
            <span className={`block size-2 rounded-full ${index === 0 ? "bg-amber-500" : index === 1 ? "bg-blue-500" : "bg-emerald-500"}`} />
            <span className="mt-1.5 block h-1.5 rounded-full bg-slate-200 dark:bg-slate-600" />
          </span>
        ))}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2">
        {["BLG 335E", "MAT 271E", "EKO 201"].map((code, index) => (
          <span key={code} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <span className="flex items-center justify-between"><span className="text-[8px] font-black text-slate-600 dark:text-slate-300">{code}</span><span className={`size-2 rounded-full ${index === 2 ? "bg-amber-400" : "bg-emerald-400"}`} /></span>
            <span className="mt-1.5 block h-1.5 rounded-full bg-slate-200 dark:bg-slate-600" />
          </span>
        ))}
      </div>
    </div>
  );
}

function FeaturePreview({ type }: { type: Feature["preview"] }) {
  return (
    <div className="relative h-44 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-inner dark:border-slate-700 dark:bg-slate-900 sm:h-48">
      <div className="absolute inset-x-0 top-0 z-20 flex h-7 items-center gap-1.5 border-b border-slate-200/80 bg-white/90 px-3 dark:border-slate-700 dark:bg-slate-800/90">
        <span className="size-1.5 rounded-full bg-rose-300" />
        <span className="size-1.5 rounded-full bg-amber-300" />
        <span className="size-1.5 rounded-full bg-emerald-300" />
        <span className="ml-2 h-1.5 w-16 rounded-full bg-slate-200 dark:bg-slate-600" />
      </div>
      <div className="h-full pt-7">
        {type === "semester" && <SemesterPreview />}
        {type === "planner" && <PlannerPreview />}
        {type === "generator" && <GeneratorPreview />}
        {type === "curriculum" && <CurriculumPreview />}
        {type === "graduation" && <GraduationPreview />}
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useLanguage();
  return (
    <main className="relative min-h-[calc(100vh-65px)] overflow-hidden bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-6 sm:py-16 lg:py-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.13),transparent_65%)]" />
      <div className="relative mx-auto max-w-6xl">
        <header className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
          <p className="text-xs font-black uppercase tracking-[.24em] text-blue-700 dark:text-blue-300">{t("home.eyebrow")}</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.035em] text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
            {t("home.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
            {t("home.description")}
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-2" aria-label={t("home.tools")}>
          {features.map((feature) => {
            const colors = accentClasses[feature.accent];
            return (
              <Link
                key={feature.href}
                href={feature.href}
                className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-black/30 sm:p-4"
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${colors.glow}`} />
                <FeaturePreview type={feature.preview} />
                <div className="relative flex items-end justify-between gap-5 px-2 pb-2 pt-5 sm:px-3 sm:pb-3">
                  <div>
                    <p className={`text-[11px] font-black uppercase tracking-[.2em] ${colors.label}`}>{t(feature.eyebrowKey)}</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{t(feature.titleKey)}</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">{t(feature.descriptionKey)}</p>
                  </div>
                  <span className={`mb-1 grid size-10 shrink-0 place-items-center rounded-full text-xl transition duration-300 group-hover:translate-x-0.5 ${colors.arrow}`} aria-hidden="true">→</span>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
