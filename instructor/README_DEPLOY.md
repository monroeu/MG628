# MG628 Instructor Control Center

Deploy `index.html` to the GitHub repository folder:

`MG628/instructor/index.html`

Expected public URL:

`https://monroeu.github.io/MG628/instructor/`

## What it does
- Instructor/admin Supabase login
- Term/course/section-aware roster management
- Add/update one student
- CSV bulk roster import
- Activate/drop roster entries
- Shows whether the student has registered a Supabase Auth account
- Shows enrollment state
- Server-verified participation results and CSV export
- Reversible instructor test-student enrollment

## CSV headers
Recommended:

`email,expected_full_name,institutional_id,roster_status`

Accepted aliases include `name`, `full_name`, `student_name`, `student_id`, and `id`.

## Security
The browser contains only the Supabase publishable key. Privileged roster/results operations are handled by the JWT-protected `instructor-api` Edge Function, which verifies the caller's `profiles.app_role` and section authorization before using server credentials.

## Monroe roster CSV format

The importer accepts Monroe University roster exports directly with these columns:

- Student Name
- Student ID
- Class Level
- Preferred Email

Mapping used by the system:

- Student Name -> expected_full_name
- Student ID -> institutional_id
- Preferred Email -> email
- Class Level is retained by the browser import parser but is not required for enrollment.

No manual column renaming is required.
