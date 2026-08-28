import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-blue-700">Build your week</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
            Weekly Lecture Program
          </h1>

          <p className="mt-2 text-gray-600">
            Plan your weekly ITU lecture schedule.
          </p>
        </header>

        <WeeklyCalendar view="planner" />
      </div>
    </main>
  );
}
