# MG628 Instructor Control Center

Upload `index.html` to `MG628/instructor/index.html` in the `monroeu/MG628` GitHub repository.

Live URL: `https://monroeu.github.io/MG628/instructor/`

## Academic Setup
The Instructor Control Center now lets an admin create or update:
- Courses
- Academic terms
- Sections

Section setup supports Monroe-style details: display code, campus, meeting day/time, section dates, room/location, seat capacity, seats available, waitlist count, and status.

## MG628-159W
Already created in Supabase:
- MG-628-159W
- Fall 2026
- New Rochelle
- Saturday 10:00 AM–1:00 PM
- Section dates: 2026-09-09 through 2026-12-17
- Room: TBD
- Capacity: 25
- Seats available: 11
- Waitlist: 0
- 14 roster students imported from the Monroe CSV
- Week 1 participation offering published

## Roster import
The CSV importer accepts Monroe exports directly with headers:
`Student Name, Student ID, Class Level, Preferred Email`
