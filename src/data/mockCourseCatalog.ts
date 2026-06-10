import type { FacultyOption } from "@/types/calendar";

export const mockCourseCatalog: FacultyOption[] = [
  {
    facultyCode: "BLG",
    courses: [
      {
        id: "blg-312e",
        code: "BLG 312E",
        title: "Operating Systems",
        sessions: [
          {
            id: "blg-312e-1",
            day: "Monday",
            startTime: "09:30",
            endTime: "12:30",
            room: "MED A-23",
          },
          {
            id: "blg-312e-2",
            day: "Thursday",
            startTime: "13:30",
            endTime: "16:30",
            room: "MED A-24",
          },
        ],
      },
      {
        id: "blg-242e",
        code: "BLG 242E",
        title: "Logic Circuits Laboratory",
        sessions: [
          {
            id: "blg-242e-1",
            day: "Friday",
            startTime: "14:00",
            endTime: "16:00",
            room: "DCL LAB",
          },
        ],
      },
    ],
  },
  {
    facultyCode: "MAT",
    courses: [
      {
        id: "mat-271e",
        code: "MAT 271E",
        title: "Probability and Statistics With A Very Long Example Name",
        sessions: [
          {
            id: "mat-271e-1",
            day: "Tuesday",
            startTime: "10:00",
            endTime: "12:00",
            room: "FEB B-04",
          },
          {
            id: "mat-271e-2",
            day: "Wednesday",
            startTime: "15:30",
            endTime: "17:30",
            room: "FEB B-07",
          },
        ],
      },
    ],
  },
  {
    facultyCode: "EEF",
    courses: [
      {
        id: "eef-231e",
        code: "EEF 231E",
        title: "Circuit Analysis",
        sessions: [
          {
            id: "eef-231e-1",
            day: "Wednesday",
            startTime: "13:30",
            endTime: "15:30",
            room: "EEF 2101",
          },
        ],
      },
    ],
  },
  {
    facultyCode: "EHB",
    courses: [
      {
        id: "ehb-222e",
        code: "EHB 222E",
        title: "Signals and Systems",
        sessions: [
          {
            id: "ehb-222e-1",
            day: "Friday",
            startTime: "08:30",
            endTime: "11:30",
            room: "EHB Z-01",
          },
        ],
      },
    ],
  },
];