import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Weekly Lecture Program
          </h1>

          <p className="mt-2 text-gray-600">
            Plan your weekly ITU lecture schedule.
          </p>
        </header>

        <WeeklyCalendar />
      </div>
    </main>
  );
}