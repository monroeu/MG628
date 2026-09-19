# MG628 Week 1 Participation — Supabase Integration

## Files
- `index.html` — deploy this as the Week 1 participation page in the MG628 GitHub Pages website.

## Supabase project
Organization: Monroe University
Project: Monroe University Academic Analytics (existing Monroe University project)
Project ref: `irnrjzeejalbbqdrbzmj`
Edge Function: `participation-api` (JWT required)

## Registered assignment
- Course: MG628
- Assignment slug: `order-quantity-weeks-1-2`
- Assignment version: 2
- Required tracked self-checks: 10
- Required exercises: 9
- Fall 2026 offerings: MG628-158W and MG628-155W

## GitHub placement
The Supabase record currently stores the page path as:

`weeks/week01/index.html`

Recommended repository layout:

```
index.html                 # course home page
weeks/
  week01/
    index.html             # this file
  week03/
    index.html             # future/other week
```

The page's Course Home link points to `../../index.html`.

## Student identity and section matching
Students do not select a section. After sign-in, `participation-api` matches the authenticated email against `private.section_roster` and creates/refreshes the appropriate enrollment.

Before student use, load each class roster into `private.section_roster`.

Example SQL for one student in Fall 2026 MG628-158W:

```sql
insert into private.section_roster
  (section_id, email, institutional_id, expected_full_name, roster_status)
select
  s.id,
  lower('student@monroeu.edu'),
  'STUDENT-ID',
  'Student Name',
  'invited'
from public.sections s
join public.courses c on c.id = s.course_id
join public.academic_terms t on t.id = s.term_id
where c.code = 'MG628'
  and t.code = '2026FA'
  and s.section_code = '158W';
```

Use section code `155W` for the other section.

## Supabase Auth
The page supports email/password account creation and sign-in.

If email confirmation is enabled in Supabase Auth, add the deployed GitHub Pages page/domain to:

Authentication -> URL Configuration -> Redirect URLs

The page sends `emailRedirectTo` using its own current URL.

## How activity is recorded
When a signed-in, rostered student uses the page:
1. Supabase verifies the authenticated user.
2. The Edge Function matches the email to the instructor roster.
3. The correct term/course/section offering is selected automatically.
4. Each required self-check opening is recorded server-side.
5. Each completed exercise is autosaved server-side.
6. The final **Record participation** button recalculates server completion.
7. A verification code is generated only when the Supabase completion record is complete.
8. The student can download a Blackboard receipt containing the Supabase session ID and verification code.

## Important production hardening note
Supabase's schema inspection currently reports Row Level Security disabled on three tables in the private schema:
- `private.knowledge_answer_keys`
- `private.section_enrollment_codes`
- `private.section_roster`

These tables are used only server-side by this design and should remain outside any exposed Data API schema. Before expanding API exposure, review and enable RLS deliberately with policies appropriate to your administration workflow. Do not expose them to browser roles.
