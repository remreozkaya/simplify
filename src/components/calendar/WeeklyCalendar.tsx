const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type Day = (typeof days)[number];

type CourseBlock = {
  id: string;
  code: string;
  title: string;
  day: Day;
  startTime: string;
  endTime: string;
  room?: string;
};

const SLOT_HEIGHT = 26;
const SLOT_MINUTES = 30;
const START_TIME = "08:00";

const courseBlocks: CourseBlock[] = [
  {
    id: "1",
    code: "BLG 312E",
    title: "Operating Systems",
    day: "Monday",
    startTime: "09:30",
    endTime: "12:30",
    room: "MED A-23",
  },
  {
    id: "2",
    code: "MAT 271E",
    title: "Probability and Statistics",
    day: "Tuesday",
    startTime: "10:00",
    endTime: "12:00",
    room: "FEB B-04",
  },
  {
    id: "3",
    code: "EEF 231E",
    title: "Circuit Analysis",
    day: "Wednesday",
    startTime: "13:30",
    endTime: "15:30",
    room: "EEF 2101",
  },
  {
    id: "4",
    code: "EHB 222E",
    title: "Signals and Systems",
    day: "Friday",
    startTime: "08:30",
    endTime: "11:30",
    room: "EHB Z-01",
  },
];

function generateTimeLabels() {
  const labels: string[] = [];

  for (let hour = 8; hour < 20; hour++) {
    labels.push(`${hour.toString().padStart(2, "0")}:00`);
    labels.push(`${hour.toString().padStart(2, "0")}:30`);
  }

  labels.push("20:00");

  return labels;
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function getCourseTop(startTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const calendarStartMinutes = timeToMinutes(START_TIME);

  return ((startMinutes - calendarStartMinutes) / SLOT_MINUTES) * SLOT_HEIGHT;
}

function getCourseHeight(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return ((endMinutes - startMinutes) / SLOT_MINUTES) * SLOT_HEIGHT;
}

function getDayIndex(day: Day) {
  return days.indexOf(day);
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

          {courseBlocks.map((course) => {
            const dayIndex = getDayIndex(course.day);
            const top = getCourseTop(course.startTime);
            const height = getCourseHeight(course.startTime, course.endTime);

            return (
              <div
                key={course.id}
                className="absolute z-10 px-1"
                style={{
                  top,
                  height,
                  left: `${(dayIndex / days.length) * 100}%`,
                  width: `${100 / days.length}%`,
                }}
              >
                <div className="h-full overflow-hidden rounded-lg border border-blue-300 bg-blue-100 p-2 text-xs opacity-[0.85] shadow-sm transition-all duration-200 hover:scale-[1.02] hover:opacity-100">
                  <div className="font-semibold text-blue-900">
                    {course.code}
                  </div>

                  <div className="mt-1 text-blue-800">{course.title}</div>

                  <div className="mt-1 text-blue-700">
                    {course.startTime} - {course.endTime}
                  </div>

                  {course.room && (
                    <div className="mt-1 text-blue-700">{course.room}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}