import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";

export default function GeneratorPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-violet-700">Find the best fit</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">Schedule Generator</h1>
          <p className="mt-2 max-w-2xl text-gray-600">Select your courses and constraints, compare valid schedules, then save your favorite to the Weekly Planner.</p>
        </header>
        <WeeklyCalendar view="generator" />
      </div>
    </main>
  );
}
