export const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type Day = (typeof days)[number];

export type CourseBlock = {
  id: string;
  code: string;
  title: string;
  day: Day;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
};

export type CourseSession = {
  id: string;
  day: Day;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
};

export type CourseOption = {
  id: string;
  code: string;
  title: string;
  sessions: CourseSession[];
};

export type FacultyOption = {
  facultyCode: string;
  courses: CourseOption[];
};

export type CourseSelection = {
  id: string;
  facultyCode: string;
  courseId: string;
  sessionId: string;
  courseBlockId?: string;
};

export type WeeklyProgram = {
  id: string;
  name: string;
  courseBlocks: CourseBlock[];
  courseSelections: CourseSelection[];
  updatedAt: string;
};