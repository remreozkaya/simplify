# Simplify

Simplify is a web application designed to make university life easier by bringing different student-planning tools into one place.

The first goal of the project is to build a weekly lecture planner for ITU students. Users will be able to create a weekly course schedule by selecting course codes, courses, and course sessions. The selected lectures will appear on a weekly calendar view.

This project is being developed step by step as a long-term full-stack web application.

## Current Status

The project is in the early development stage.

Implemented or in progress:

* Next.js project setup
* TypeScript support
* Tailwind CSS styling
* Weekly calendar layout
* Monday-Sunday calendar view
* Time range from 08:00 to 20:00

## First Main Feature: Weekly Lecture Program

The Weekly Lecture Program will allow users to create a visual weekly schedule.

Planned functionality:

* View a weekly calendar
* Add lectures to the calendar
* Select lecture code, such as BLG, EEF, EHB, MAT
* Select a course under the chosen lecture code
* Select a course session/CRN
* Display the selected session on the weekly calendar
* Detect overlapping lecture times
* Save selected lectures locally
* Later, fetch real course data from ITU OBS

## Future Features

The long-term goal is to turn Simplify into a broader university-life planning platform.

Possible future features:

* Course schedule planner
* Time conflict detection
* Multiple saved weekly schedules
* Course search and filtering
* Automatic data sync from ITU OBS
* Exam calendar
* Assignment and deadline tracker
* GPA calculator
* Degree progress tracker
* Double-major/minor planning support
* Study plan generator
* Export schedule as image or PDF
* User accounts and cloud-saved schedules

## Tech Stack

Current stack:

* Next.js
* TypeScript
* Tailwind CSS
* React

Planned future additions:

* Prisma
* PostgreSQL
* Authentication
* Scheduled course-data sync
* Deployment on Vercel or a similar platform

## Project Structure

Planned structure:

```txt
src/
  app/
    page.tsx

  components/
    calendar/
      WeeklyCalendar.tsx

    courses/
      AddLectureModal.tsx

  data/
    mockCourses.ts

  lib/
    time.ts
    conflict.ts

  types/
    course.ts
```

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the app:

```txt
http://localhost:3000
```

## Git Workflow

The project currently uses a simple branch workflow.

```txt
main
```

Stable version of the project.

```txt
feature/weekly-calendar
```

Development branch for the weekly calendar feature.

Typical workflow:

```bash
git checkout main
git pull
git checkout -b feature/name-of-feature
```

After making changes:

```bash
git add .
git commit -m "Describe the change"
git push -u origin feature/name-of-feature
```

## Roadmap

### Phase 1 — Project Setup

* [x] Create GitHub repository
* [x] Create Next.js project
* [x] Configure TypeScript and Tailwind CSS
* [ ] Create clean project folder structure
* [ ] Update README

### Phase 2 — Weekly Calendar Layout

* [ ] Build weekly calendar grid
* [ ] Show Monday-Sunday columns
* [ ] Show time range from 08:00 to 20:00
* [ ] Align time labels with calendar lines
* [ ] Make layout visually clean and responsive

### Phase 3 — Mock Course Data

* [ ] Define course data types
* [ ] Add mock lecture codes
* [ ] Add mock courses
* [ ] Add mock course sessions
* [ ] Render a selected mock course on the calendar

### Phase 4 — Add Lecture Flow

* [ ] Add "Add Lecture" button
* [ ] Create lecture selection modal
* [ ] Select course code
* [ ] Select course
* [ ] Select session/CRN
* [ ] Add selected session to calendar

### Phase 5 — Conflict Detection

* [ ] Detect overlapping lectures
* [ ] Warn the user about conflicts
* [ ] Prevent or mark conflicting sessions

### Phase 6 — Persistence

* [ ] Save selected lectures in localStorage
* [ ] Restore selected lectures after page refresh
* [ ] Later, save schedules in a database

### Phase 7 — ITU OBS Integration

* [ ] Investigate ITU OBS course schedule requests
* [ ] Parse real course schedule data
* [ ] Store course data in database
* [ ] Add manual course-data sync
* [ ] Later, add automatic sync every 5 minutes

### Phase 8 — Deployment

* [ ] Prepare production build
* [ ] Deploy first public version
* [ ] Add environment variables if needed
* [ ] Document deployment process

## Notes

This project is intentionally being built incrementally. The first priority is to create a clean and working weekly lecture planner with mock data. Real ITU OBS integration and database synchronization will be added after the core user interface and schedule logic are stable.
