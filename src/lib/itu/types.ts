/**
 * Domain models used by the İTÜ OBS integration.
 *
 * Keep these types independent from React and the calendar UI. The adapter
 * layer is responsible for converting this data into `FacultyOption`,
 * `CourseOption`, and `CourseSession`.
 */

export type ItuWeekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

/**
 * A course branch/code option exposed by the OBS course-schedule page.
 *
 * Example:
 * { id: 3, code: "BLG" }
 */
export type ItuBranch = {
  id: number;
  code: string;
  name?: string;
};

/**
 * Generic representation of an HTML table before its columns are interpreted.
 */
export type ParsedHtmlTable = {
  headers: string[];
  rows: string[][];
};

/**
 * One raw schedule-table row after header names have been mapped, but before
 * values such as days, time ranges, and numeric capacities are normalized.
 *
 * Numeric-looking values intentionally remain strings at this stage because
 * they originate in HTML.
 */
export type ItuCourseTableRow = {
  crn: string;
  courseCode: string;
  courseTitle: string;
  teachingMethod?: string;
  instructor?: string;
  building?: string;
  day?: string;
  time?: string;
  room?: string;
  capacity?: string;
  enrolled?: string;
  reserved?: string;
  majorRestriction?: string;
  classRestriction?: string;
  prerequisites?: string;
};

/**
 * One physical meeting belonging to a CRN.
 *
 * A single CRN may contain multiple meetings, such as a lecture on Monday and
 * a laboratory on Wednesday. This is why meetings are modeled separately from
 * course sections.
 */
export type ItuCourseMeeting = {
  day: ItuWeekday;
  startTime: string;
  endTime: string;
  building?: string;
  room?: string;
};

/**
 * A single offered section/CRN.
 */
export type ItuCourseSection = {
  id: string;
  crn: string;
  courseCode: string;
  courseTitle: string;
  teachingMethod?: string;
  instructor?: string;
  meetings: ItuCourseMeeting[];
  capacity?: number;
  enrolled?: number;
  reserved?: number;
  majorRestriction?: string;
  classRestriction?: string;
  prerequisites?: string;
};

/**
 * Sections grouped under a course code and title.
 */
export type ItuCourse = {
  id: string;
  code: string;
  title: string;
  sections: ItuCourseSection[];
};

/**
 * Normalized course data for one branch.
 */
export type ItuCourseCatalog = {
  branchId: number;
  branchCode: string;
  courses: ItuCourse[];
  fetchedAt: string;
};

/**
 * Validated query accepted by the branch-specific courses endpoint.
 */
export type ItuCoursesQuery = {
  branchId: number;
  branchCode: string;
};
