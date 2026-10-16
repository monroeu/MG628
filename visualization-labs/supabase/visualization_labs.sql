-- Supabase migration already deployed Oct 16 2026. Safe for reruns.
create table if not exists public.visualization_lab_progress (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 offering_id uuid not null references public.assignment_offerings(id) on delete cascade,
 lab_slug text not null check (lab_slug in ('powerbi','tableau')),
 checks jsonb not null default '{}'::jsonb,
 notes jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 unique(student_id,offering_id,lab_slug)
);
create table if not exists public.visualization_lab_submissions (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 offering_id uuid not null references public.assignment_offerings(id) on delete cascade,
 lab_slug text not null check (lab_slug in ('powerbi','tableau')),
 track text not null default 'general',reflection text not null default '',
 files jsonb not null default '[]'::jsonb,submitted_at timestamptz not null default now(),
 score numeric(5,2),instructor_feedback text,reviewed_at timestamptz,
 unique(student_id,offering_id,lab_slug),
 constraint visualization_lab_score_range check (score is null or score between 0 and 100)
);
alter table public.visualization_lab_progress enable row level security;
alter table public.visualization_lab_submissions enable row level security;
revoke all on public.visualization_lab_progress from anon,authenticated;
revoke all on public.visualization_lab_submissions from anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('mg628-lab-submissions','mg628-lab-submissions',false,52428800,null)
on conflict (id) do update set public=false;
insert into public.participation_assignments(course_id,slug,title,description,version,page_path,is_active)
select c.id,v.slug,v.title,v.description,1,v.path,true
from public.courses c cross join (values
 ('viz-powerbi','Power BI Dashboard Laboratory','Week 6 hospital and housing reports','/MG628/visualization-labs/powerbi/'),
 ('viz-tableau','Tableau Dashboard Laboratory','Tableau dashboard practice','/MG628/visualization-labs/tableau/')
) as v(slug,title,description,path)
where c.code='MG628' and not exists
 (select 1 from public.participation_assignments a where a.course_id=c.id and a.slug=v.slug);
insert into public.assignment_offerings
 (assignment_id,section_id,published,require_all_cards,require_all_questions,require_worksheet,require_reflection)
select a.id,s.id,false,false,false,false,false
from public.participation_assignments a
join public.courses c on c.id=a.course_id
join public.sections s on s.course_id=c.id
where c.code='MG628' and a.slug in ('viz-powerbi','viz-tableau') and s.status='active'
and not exists (select 1 from public.assignment_offerings o where o.assignment_id=a.id and o.section_id=s.id);
