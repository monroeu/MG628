# MG628 Week 3 Participation Website

## GitHub upload

Create a `week03` folder in your MG628 repository and upload the package contents:

- `index.html`
- `week03-case-study-assignment.pdf`
- `week03-overview-learning-objectives.pdf`
- `data/` and all files inside it

Live URL after GitHub Pages redeploys:

`https://monroeu.github.io/MG628/week03/`

The page links back to the course home with `../`.

## Server-side participation

The current Week 1 Apps Script only recognizes the Weeks 1–2 assignment code.
Replace it with:

`AppsScript_MG628_multiweek_servervalidated.gs`

This consolidated backend supports both:
- `ORDER_QUANTITY_WEEKS_1_2`
- `WEEK03_DATA_STRUCTURES_CASE_STUDY`

Update the existing deployment:

1. Open the existing MG628 Apps Script project.
2. Replace `Code.gs` with `AppsScript_MG628_multiweek_servervalidated.gs`.
3. Save.
4. Deploy -> Manage deployments.
5. Edit the existing Web App deployment.
6. Choose **New version**.
7. Deploy.

Keep the same deployment. The `/exec` URL remains unchanged, so Week 1 and Week 3 both submit to the same Google Sheet.

The backend adds two columns to the existing `Submissions` sheet:
- Assignment Code
- Week / Activity

Existing Week 1 rows are preserved.
