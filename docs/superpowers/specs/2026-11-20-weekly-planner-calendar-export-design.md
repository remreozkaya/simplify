# Weekly Planner calendar export

## Student workflow

Add **Export calendar (.ics)** beside the JPEG export in Weekly Planner. The action applies to the selected saved timetable, including timetables saved from the schedule generator. Before downloading, show the İTÜ academic year, semester, inclusive teaching dates, published break dates, and a link to the source. The student then downloads one `.ics` file named after the timetable. Provide the same workflow in Turkish and English, including loading, retry, and error messages.

## Academic calendar rules

- Use the **Lisans / Önlisans Akademik Takvimi** section of the official Turkish [İTÜ Academic Calendar](https://www.takvim.sis.itu.edu.tr/AkademikTakvim/TR/akademik-takvim/AkademikTakvimTablo.php). Select the academic year first, then the Güz or Bahar section. This keeps the two semesters' identically named `Ara Tatil` rows separate and avoids pulling dates from other academic programs on the page.
- Match the exact semester start and end labels, allowing for whitespace and Unicode normalization. `Güz Yarıyılı Başlangıcı` and `Güz Yarıyılı Sonu` define fall. `Bahar Yarıyılı Başlangıcı` and `Bahar Yarıyılı Sonu` define spring. Both dates are inclusive. The exact end label distinguishes the teaching boundary from rows about final exams.
- Exclude every calendar date in each `Ara Tatil` range for the chosen semester, including both ends of the range. The published dates define the exclusion. For example, a Saturday class still appears if the published break ends on Friday. A semester with a valid calendar section and no `Ara Tatil` row has no break exclusions.
- The first version covers fall and spring. It exports scheduled class meetings, with `Ara Tatil` as the only calendar exception. Finals, public-holiday exceptions, rescheduled classes, and summer teaching would require their own rules.

| Official 2026–2027 semester | First teaching date | Last teaching date | Excluded dates |
| --- | --- | --- | --- |
| Güz | 28 September 2026 | 31 December 2026 | 16–20 November 2026 |
| Bahar | 1 February 2027 | 30 April 2027 | 8–12 March 2027 |

These dates are test examples from the official page. The feature reads the published dates when resolving a semester.

## Semester resolution and failure states

- Resolve the semester from the OBS metadata on the timetable's course meetings. Verify how OBS identifiers map to academic years and terms against official data before relying on that mapping. Use the matching official year when İTÜ exposes it through the calendar. This lets a timetable keep its teaching dates after OBS switches its active semester.
- If any meeting lacks recognizable semester metadata, ask the student to confirm an academic year and term from the available official choices. When other meetings identify a single semester, constrain confirmation to that semester. A plan with conflicting known semesters requires separate timetables before export. An identified semester whose official calendar is unavailable shows an error tied to that semester.
- Load the recognized calendar on the server from the official site and return only the normalized academic year, term, date ranges, and source to the browser. Reuse the existing Cheerio dependency. Validate dates and range order, reject missing or conflicting boundary rows and invalid break ranges, and use a short cache for validated results so official corrections can propagate. If the site times out or changes format, show a localized retry message and a link to the source.
- Disable export for an empty timetable and while its calendar is loading. If a meeting has an invalid time range or the timetable yields zero occurrences, show an explanation and stop the download.

## Calendar file

- Use each saved meeting's weekday, start time, and end time. Start its series on the first eligible occurrence and stop at the last eligible occurrence within the teaching dates. Courses with multiple weekly meetings get a series for each time slot, including separate lecture and lab meetings.
- Use weekly iCalendar recurrence rules and `EXDATE` exceptions for any break dates within the series. Interpret times in `Europe/Istanbul` and use the matching timezone information in the file so calendar apps can display the correct local time.
- Use course code and title as the event summary, building and room as the location when available, and CRN and instructor as optional details. Preserve Turkish characters, escape text, fold long lines, and generate stable event IDs from the plan, term, and meeting. Follow the [iCalendar specification](https://www.rfc-editor.org/rfc/rfc5545).
- Generate the file in the browser from the selected timetable. The export is a snapshot. Schedule or academic calendar changes after import require a fresh export and import.

## Implementation approach

Use the official HTML table as the calendar source because it labels the academic year, calendar, and term explicitly. İTÜ also offers a calendar download for selected academic events, but that interface serves a different workflow and would add a dependency on its selection and download behavior. Keep fetching and parsing separate from the pure date and `.ics` generation functions, and connect both to the existing Weekly Planner export controls. Reuse the timetable's stored meeting data and existing Turkish and English translations infrastructure.

## Verification

- Use official-page fixtures for both semesters and test that similar labels, final exam dates, and duplicate `Ara Tatil` labels in other sections cannot affect the selected term. Cover single dates, ranges across months or years, a valid semester without a break, and malformed or missing rows.
- Verify the first and last teaching dates when they match a class weekday, exclusions at both ends of a break, weekend meetings outside the published break dates, and separate lecture and lab series.
- Verify term resolution for generated and manually assembled plans, older plans with missing metadata, mixed-term plans, unavailable source data, and empty plans. Check Turkish and English feedback and the download from the normal planner screen.
- Parse the generated file in tests and check an import in Google Calendar, Apple Calendar, and Outlook where available. Verify Istanbul times, location, encoding, recurrence end, and the skipped dates. Report any calendar client that could not be verified.
