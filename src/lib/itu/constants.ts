import type { ItuWeekday } from "@/lib/itu/types";

/**
 * Public İTÜ OBS course-schedule endpoints.
 */
export const ITU_OBS_ORIGIN =
  "https://obs.itu.edu.tr";

export const ITU_OBS_PATHS = {
  courseSchedule: "/public/DersProgram",
  branchesSearch:
    "/public/DersProgram/SearchBransKoduByProgramSeviye",
  courseSearch:
    "/public/DersProgram/DersProgramSearch",
} as const;

/**
 * OBS query values used by the undergraduate course-schedule page.
 */
export const ITU_PROGRAM_LEVELS = {
  undergraduate: "LS",
} as const;

export const ITU_QUERY_PARAMETER_NAMES = {
  programLevel: "programSeviyeTipiAnahtari",
  branchId: "dersBransKoduId",
} as const;

/**
 * The official schedule page states that its data is refreshed every five
 * minutes, so the application should not poll or revalidate more frequently.
 */
export const ITU_CACHE_REVALIDATE_SECONDS =
  5 * 60;

export const ITU_REQUEST_TIMEOUT_MS = 15_000;

export const ITU_REQUEST_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml",
  "Accept-Language":
    "tr-TR,tr;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (compatible; Simplify/0.1; +https://github.com/remreozkaya/simplify)",
} as const;

/**
 * Values that should be interpreted as an empty OBS table cell.
 */
export const ITU_EMPTY_CELL_VALUES =
  new Set(["", "-", "--", "—"]);

/**
 * Day aliases found in Turkish and English OBS pages.
 *
 * Parsers should normalize source text with:
 * value.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR")
 * before looking it up here.
 */
export const ITU_WEEKDAY_ALIASES: Readonly<
  Record<string, ItuWeekday>
> = {
  monday: "Monday",
  mon: "Monday",
  pazartesi: "Monday",
  pzt: "Monday",

  tuesday: "Tuesday",
  tue: "Tuesday",
  salı: "Tuesday",
  sali: "Tuesday",
  sal: "Tuesday",

  wednesday: "Wednesday",
  wed: "Wednesday",
  çarşamba: "Wednesday",
  carsamba: "Wednesday",
  çar: "Wednesday",
  car: "Wednesday",

  thursday: "Thursday",
  thu: "Thursday",
  perşembe: "Thursday",
  persembe: "Thursday",
  per: "Thursday",
  pers: "Thursday",

  friday: "Friday",
  fri: "Friday",
  cuma: "Friday",
  cum: "Friday",

  saturday: "Saturday",
  sat: "Saturday",
  cumartesi: "Saturday",
  cmt: "Saturday",

  sunday: "Sunday",
  sun: "Sunday",
  pazar: "Sunday",
  paz: "Sunday",
};

/**
 * Header aliases used when converting the OBS schedule table into named
 * fields. Parser code should normalize header text before matching it.
 */
export const ITU_COURSE_TABLE_HEADER_ALIASES = {
  crn: ["crn"],

  courseCode: [
    "ders kodu",
    "course code",
  ],

  courseTitle: [
    "ders adı",
    "ders adi",
    "course title",
    "course name",
  ],

  teachingMethod: [
    "öğretim yöntemi",
    "ogretim yontemi",
    "teaching method",
  ],

  instructor: [
    "öğretim elemanı",
    "ogretim elemani",
    "instructor",
  ],

  building: [
    "bina",
    "building",
  ],

  day: [
    "gün",
    "gun",
    "day",
  ],

  time: [
    "saat",
    "time",
  ],

  room: [
    "derslik",
    "salon",
    "room",
    "classroom",
  ],

  capacity: [
    "kontenjan",
    "capacity",
  ],

  enrolled: [
    "kayıtlı",
    "kayitli",
    "enrolled",
  ],

  reserved: [
    "rezerv",
    "reserved",
  ],

  majorRestriction: [
    "bölüm kısıtı",
    "bolum kisiti",
    "major restriction",
  ],

  classRestriction: [
    "sınıf kısıtı",
    "sinif kisiti",
    "class restriction",
  ],

  prerequisites: [
    "ön şart",
    "on sart",
    "önşart",
    "onsart",
    "prerequisite",
    "prerequisites",
  ],
} as const;
