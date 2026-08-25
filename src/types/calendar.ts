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
  selectionId?: string;
  code: string;
  title: string;
  crn?: string;
  day: Day;
  startTime: string;
  endTime: string;
  building?: string;
  room?: string;
  instructor?: string;
};

export type CourseMeetingOption = {
  id: string;
  day: Day;
  startTime: string;
  endTime: string;
  building?: string;
  room?: string;
};

export type CourseSectionOption = {
  id: string;
  crn: string;
  instructor?: string;
  meetings: CourseMeetingOption[];
};

export type CourseOption = {
  id: string;
  code: string;
  title: string;
  sections: CourseSectionOption[];
};

export type FacultyOption = {
  facultyCode: string;
  courses: CourseOption[];
};

export type CourseSelection = {
  id: string;
  facultyCode: string;
  courseId: string;
  sectionId: string;
  courseBlockIds: string[];
};

export type WeeklyProgram = {
  id: string;
  name: string;
  courseBlocks: CourseBlock[];
  courseSelections: CourseSelection[];
  updatedAt: string;
};
