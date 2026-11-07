# MG628 Week 9 — Regression and Predictive Modeling Lab

Live URL after publishing: `https://monroeu.github.io/MG628/week09/`

## What's in this release

```text
MG628/
├── lab-engine/          # NEW, shared by Week 9 and future lecture labs
│   ├── app.js           # lab logic: narrated slides, concepts, cards, checks, quizzes, dashboard
│   ├── lab.css          # lab styles (light and dark)
│   ├── schema.sql       # Supabase tables and functions (all prefixed mg628_)
│   ├── build_lab.py     # builds a new week's lab from a deck, narration and content file
│   └── ...              # templates used by build_lab.py
└── week09/              # NEW
    ├── index.html
    ├── lab-config.js    # lab settings (Supabase project, optional participation assignment ID)
    ├── data.js          # lab content and slide timings
    ├── lab.sql          # Week 9 slides and 50 graded questions for Supabase
    ├── frames/          # 296 slide-build images
    └── narration.mp4    # narration (19 MB)
```

Nothing outside `lab-engine/` and `week09/` is changed. The page uses the site's existing global navigation (`assets/week-auto-activate.js`), Student ID sign-in (`student-auth-api`), roster check (`participation-api`) and, when configured, central active study time (`shared/active-time.js`).

## 1. Supabase (one time)

In the Monroe participation project (`irnrjzeejalbbqdrbzmj`), open **SQL Editor** and run, in order:

1. `lab-engine/schema.sql`
2. `week09/lab.sql`
3. Add your instructor sign-in email:
   ```sql
   insert into public.mg628_instructors (email) values ('your-instructor-email');
   ```

Every table and function is prefixed `mg628_`; nothing else in the project is created, changed or removed.

## 2. Link it to the participation system (recommended)

Create or publish the Week 9 participation assignment for MG-628-159W in the Instructor Control Center with page path `week09/index.html`. This:

- shows **Week 9** as AVAILABLE NOW on the course home page and in the top navigation, and
- if you paste the assignment's ID into `participationAssignmentId` in `week09/lab-config.js`, records only students in sections where it's published, opens a participation session for them, and logs their active study time centrally, like Weeks 5–7.

If `participationAssignmentId` is left empty, any student on an MG628 roster is recorded.

## 3. Publish with GitHub Desktop

1. Extract this package into the repository folder (`Documents\GitHub-Clean\MG628-Verified`) so `lab-engine` and `week09` sit beside `week08`.
2. Open **GitHub Desktop**; the repository shows the new files under **Changes**.
3. Enter a summary such as `Add Week 9 regression lab`, then **Commit to main**.
4. Click **Push origin**. GitHub Pages updates within a few minutes.

## 4. Check it

Open `https://monroeu.github.io/MG628/week09/`, sign in with a test Student ID, watch a slide through to its last build, and confirm it shows as verified. Then sign in with your instructor email and open **Class progress**.
