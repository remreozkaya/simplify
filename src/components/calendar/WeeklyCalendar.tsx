const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SLOT_HEIGHT = 26;

function generateTimeLabels() {
  const labels: string[] = [];

  for (let hour = 8; hour < 20; hour++) {
    labels.push(`${hour.toString().padStart(2, "0")}:00`);
    labels.push(`${hour.toString().padStart(2, "0")}:30`);
  }

  labels.push("20:00");

  return labels;
}

const timeLabels = generateTimeLabels();

export default function WeeklyCalendar() {
  const calendarHeight = (timeLabels.length - 1) * SLOT_HEIGHT;

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-transparent shadow-sm">
      <div className="w-full">
        <div className="ml-12 grid grid-cols-7 border-b border-gray-200">
          {days.map((day) => (
            <div
              key={day}
              className="border-r border-gray-200 bg-transparent p-3 text-center text-sm font-semibold text-gray-700 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="relative ml-12" style={{ height: calendarHeight }}>
          {timeLabels.map((time, index) => (
            <div
              key={time}
              className="absolute left-0 w-full border-t border-gray-200"
              style={{ top: index * SLOT_HEIGHT }}
            >
              {time !== "20:00" && (
                <span
                  className={
                    time.endsWith(":00")
                      ? "absolute -left-11 w-10 -translate-y-1/2 pr-1 text-right text-xs font-medium text-gray-600"
                      : "absolute -left-11 w-10 -translate-y-1/2 pr-1 text-right text-xs text-gray-400"
                  }
                >
                  {time}
                </span>
              )}
            </div>
          ))}

          <div className="grid h-full grid-cols-7">
            {days.map((day) => (
              <div
                key={day}
                className="border-r border-gray-200 last:border-r-0"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}