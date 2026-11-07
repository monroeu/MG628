-- MG628 Labs: Supabase schema (shared by every MG628 lab)
-- Designed to live alongside other courses in the same Supabase project: every table and function is prefixed mg628_,
-- and nothing outside that prefix is created, changed or dropped.
-- Run once in the Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run). Safe to re-run.
-- Each lab then adds its own slides and questions by running labs/<lab-id>/lab.sql.

create extension if not exists pgcrypto;

-- 1. Instructors: emails listed here can see every student's records.
create table if not exists public.mg628_instructors (
  email text primary key
);
alter table public.mg628_instructors enable row level security;   -- no policies: not readable through the API

create or replace function public.mg628_is_instructor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mg628_instructors where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.mg628_is_instructor() to authenticated;

-- 2. Progress: one row per student per lab (engagement data written by the browser).
create table if not exists public.mg628_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  lab        text not null default 'regression',
  email      text,
  full_name  text,
  student_id text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, lab)
);
alter table public.mg628_progress enable row level security;
drop policy if exists "read own or instructor" on public.mg628_progress;
create policy "read own or instructor" on public.mg628_progress for select to authenticated using (auth.uid() = user_id or public.mg628_is_instructor());
drop policy if exists "insert own" on public.mg628_progress;
create policy "insert own" on public.mg628_progress for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "update own" on public.mg628_progress;
create policy "update own" on public.mg628_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.mg628_progress_set_email() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.email := coalesce(auth.jwt() ->> 'email', new.email);
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists mg628_progress_set_email on public.mg628_progress;
create trigger mg628_progress_set_email before insert or update on public.mg628_progress for each row execute function public.mg628_progress_set_email();
alter table public.mg628_progress drop constraint if exists mg628_progress_data_size;
alter table public.mg628_progress add constraint mg628_progress_data_size check (pg_column_size(data) < 200000);

-- 3. Lab content: slides (with narration length) and the graded question bank. Not readable by students.
create table if not exists public.mg628_lab_slides (
  lab    text not null,
  slide  int  not null,
  module text not null,
  dur    numeric not null,
  primary key (lab, slide)
);
alter table public.mg628_lab_slides enable row level security;

create table if not exists public.mg628_lab_questions (
  lab    text not null default 'regression',
  id     text not null,
  module text not null,
  kind   text not null check (kind in ('static','gen')),
  body   jsonb not null,
  primary key (lab, id)
);
alter table public.mg628_lab_questions enable row level security;

-- 4. Server-verified slide watching.
create table if not exists public.mg628_slide_views (
  user_id    uuid not null references auth.users (id) on delete cascade,
  lab        text not null,
  slide      int  not null,
  watched_at timestamptz not null default now(),
  primary key (user_id, lab, slide)
);
alter table public.mg628_slide_views enable row level security;
drop policy if exists "read own or instructor" on public.mg628_slide_views;
create policy "read own or instructor" on public.mg628_slide_views for select to authenticated using (auth.uid() = user_id or public.mg628_is_instructor());

-- One slide "on screen" per student at a time, so slides can't be watched in parallel.
create table if not exists public.mg628_slide_active (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  lab        text not null,
  slide      int  not null,
  started_at timestamptz not null default now()
);
alter table public.mg628_slide_active enable row level security;

-- 5. Quiz and warm-up mg628_attempts.
create table if not exists public.mg628_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  lab          text not null default 'regression',
  module       text not null,
  kind         text not null check (kind in ('quiz','retrieval')),
  items        jsonb not null,
  answers      jsonb,
  results      jsonb,
  score        int,
  n            int not null,
  passed       boolean,
  late         boolean not null default false,
  created_at   timestamptz not null default now(),
  submitted_at timestamptz
);
create index if not exists mg628_attempts_user_lab_idx on public.mg628_attempts (user_id, lab, module, kind);
alter table public.mg628_attempts enable row level security;
drop policy if exists "read own or instructor" on public.mg628_attempts;
create policy "read own or instructor" on public.mg628_attempts for select to authenticated using (auth.uid() = user_id or public.mg628_is_instructor());

create table if not exists public.mg628_attempt_keys (
  attempt_id uuid primary key references public.mg628_attempts (id) on delete cascade,
  keys       jsonb not null
);
alter table public.mg628_attempt_keys enable row level security;   -- no policies: never readable


-- ---------- helpers ----------
create or replace function public.mg628_lab_f(x numeric, d int default 0) returns text
language sql immutable as $$
  select case when d = 0 then to_char(round(x), 'FM999,999,999,990')
              else to_char(round(x, d), 'FM999,999,999,990.' || repeat('0', d)) end;
$$;

create or replace function public.mg628_lab_f(x double precision, d int default 0) returns text
language sql immutable as $$ select public.mg628_lab_f(x::numeric, d); $$;

-- Build an item from options whose first element is correct; shuffle them.
create or replace function public.mg628_lab_mk(stem text, opts text[], why text) returns jsonb
language plpgsql volatile as $$
declare perm int[]; o text[] := '{}'; ans int; k int; n int := array_length(opts, 1);
begin
  select array_agg(i order by random()) into perm from generate_series(1, n) i;
  for k in 1..n loop
    o := o || opts[perm[k]];
    if perm[k] = 1 then ans := k - 1; end if;
  end loop;
  return jsonb_build_object('stem', stem, 'opts', to_jsonb(o), 'ans', ans, 'why', why);
end; $$;

create or replace function public.mg628_lab_static(b jsonb) returns jsonb
language plpgsql volatile as $$
declare opts text[] := array[b->'opts'->>((b->>'ans')::int)]; k int;
begin
  for k in 0..jsonb_array_length(b->'opts') - 1 loop
    if k <> (b->>'ans')::int then opts := opts || (b->'opts'->>k); end if;
  end loop;
  return public.mg628_lab_mk(b->>'stem', opts, b->>'why');
end; $$;

-- Generated questions with fresh numbers every time.
create or replace function public.mg628_lab_gen(g text) returns jsonb
language plpgsql volatile as $$
declare s numeric; c numeric; d numeric; b numeric; p numeric; m numeric; r numeric; v numeric; t int; k int;
  e numeric[]; mae numeric; rmse numeric; lst text; cat text; cls text; se_m numeric; se_p numeric;
  stmts text[][]; steps text[] := array['Finding','Evidence','Implication','Action','Risk']; others text[];
begin
  case g
  when 'm2_predict' then
    s := (50 + floor(random() * 350)) * 100; c := 172.5 + 0.01546 * s;
    return public.mg628_lab_mk('Using Leads = 172.5 + 0.01546 × Spend, how many leads would you predict for a campaign that spends $' || mg628_lab_f(s) || '?',
      array[mg628_lab_f(c) || ' leads', mg628_lab_f(0.01546 * s) || ' leads', mg628_lab_f(172.5 + 0.01546 * s / 1000) || ' leads', mg628_lab_f(c * 1.25) || ' leads'],
      '172.5 + 0.01546 × ' || mg628_lab_f(s) || ' ≈ ' || mg628_lab_f(c) || '. Leaving out the intercept gives ' || mg628_lab_f(0.01546 * s) || '.');
  when 'm2_change' then
    d := (10 + floor(random() * 110)) * 100; c := 0.01546 * d;
    return public.mg628_lab_mk('Campaign spend rises by $' || mg628_lab_f(d) || '. By how many leads does Leads = 172.5 + 0.01546 × Spend predict leads will rise, on average?',
      array[mg628_lab_f(c, 1), mg628_lab_f(172.5 + c, 1), mg628_lab_f(d / 1000, 1), mg628_lab_f(c * 10, 1)],
      'A change in X moves the prediction by slope × change: 0.01546 × ' || mg628_lab_f(d) || ' ≈ ' || mg628_lab_f(c, 1) || '. The intercept does not enter a change.');
  when 'm2_marginal' then
    b := (array[0.0120, 0.0135, 0.0150, 0.0165, 0.0180, 0.0195])[1 + floor(random() * 6)]; c := 1 / b;
    return public.mg628_lab_mk('A channel''s model has a slope of ' || b::text || ' leads per dollar of spend. About how much does one additional lead cost?',
      array['$' || mg628_lab_f(c, 2), '$' || mg628_lab_f(b * 1000, 2), '$' || b::text, '$37.79'],
      'Cost per additional lead = 1 ÷ slope = 1 ÷ ' || b::text || ' ≈ $' || mg628_lab_f(c, 2) || '.');
  when 'm2_elastic' then
    p := (array[5, 10, 15, 20, 25, 30])[1 + floor(random() * 6)]; c := (power(1 + p / 100, 0.70) - 1) * 100;
    return public.mg628_lab_mk('In the log-log model log(Leads) = −0.69 + 0.70 × log(Spend), spend rises ' || p || '%. By about what percentage do leads rise?',
      array[mg628_lab_f(c, 1) || '%', mg628_lab_f(p, 1) || '%', mg628_lab_f(p / 0.7, 1) || '%', mg628_lab_f(p * 0.3, 1) || '%'],
      '(1 + ' || p || '/100)^0.70 − 1 ≈ ' || mg628_lab_f(c, 1) || '%, less than ' || p || '% because returns diminish.');
  when 'm3_dummies' then
    k := 3 + floor(random() * 5); cat := (array['regions','sales channels','product lines','insurance types','program types'])[1 + floor(random() * 5)];
    return public.mg628_lab_mk('A categorical predictor has ' || k || ' ' || cat || '. How many dummy variables go into the regression?',
      array[(k - 1)::text, k::text, (k - 2)::text, (k + 1)::text],
      'k categories need k − 1 dummies; the one left out is the baseline. Here ' || k || ' − 1 = ' || (k - 1) || '.');
  when 'm3_coef' then
    c := round((0.85 + random() * 0.35)::numeric, 3); d := (20 + floor(random() * 130)) * 100; r := c * d;
    return public.mg628_lab_mk('In a revenue model, the deal-size coefficient is ' || c::text || '. Holding the other predictors constant, how much more monthly revenue is associated with a deal that is $' || mg628_lab_f(d) || ' larger?',
      array['$' || mg628_lab_f(r), '$' || mg628_lab_f(d), '$' || mg628_lab_f(d / c), '$' || mg628_lab_f(r / 12)],
      'Coefficient × change: ' || c::text || ' × ' || mg628_lab_f(d) || ' ≈ $' || mg628_lab_f(r) || ', other predictors held constant.');
  when 'm3_lpm' then
    b := (array[0.0042, 0.0058, 0.0066, 0.0081, 0.0097])[1 + floor(random() * 5)]; m := 2 + floor(random() * 3); r := m * b * 100;
    return public.mg628_lab_mk('A linear probability model of 30-day readmission has a coefficient of ' || b::text || ' on chronic conditions. A patient with ' || m || ' more chronic conditions has a predicted readmission probability that is higher by:',
      array[mg628_lab_f(r, 2) || ' percentage points', mg628_lab_f(m * b, 4) || ' percentage points', mg628_lab_f(b * 100, 2) || ' percentage points', mg628_lab_f(r * 10, 1) || ' percentage points'],
      'Each condition adds ' || b::text || ' in probability, i.e. ' || mg628_lab_f(b * 100, 2) || ' points; × ' || m || ' = ' || mg628_lab_f(r, 2) || ' percentage points.');
  when 'm3_vif' then
    r := (array[0.60, 0.75, 0.80, 0.90, 0.95])[1 + floor(random() * 5)]; v := 1 / (1 - r);
    return public.mg628_lab_mk('Regressing one predictor on all the other predictors gives R² = ' || r::text || '. What is that predictor''s VIF?',
      array[mg628_lab_f(v, 1), mg628_lab_f(1 / r, 1), mg628_lab_f(1 - r, 2), mg628_lab_f(r / (1 - r), 1)],
      'VIF = 1 ÷ (1 − R²) = 1 ÷ ' || mg628_lab_f(1 - r, 2) || ' = ' || mg628_lab_f(v, 1) || '. Above 5 deserves a look; above 10 is severe.');
  when 'm4_cooks' then
    t := 30 + floor(random() * 171); c := 4.0 / t;
    return public.mg628_lab_mk('A regression uses ' || t || ' observations. Using the 4 ÷ n rule of thumb, above what Cook''s distance would you flag a point as influential?',
      array[mg628_lab_f(c, 3), mg628_lab_f(1.0 / t, 3), mg628_lab_f(t / 4.0, 1), mg628_lab_f(4.0 / sqrt(t), 3)],
      '4 ÷ ' || t || ' ≈ ' || mg628_lab_f(c, 3) || '.');
  when 'm4_dw' then
    d := (array[0.62, 0.95, 1.94, 2.06, 3.10, 3.45])[1 + floor(random() * 6)];
    cls := case when d < 1.5 then 'Positive autocorrelation: errors are correlated' when d > 2.5 then 'Negative autocorrelation: errors alternate' else 'No evidence of autocorrelation' end;
    others := array_remove(array['No evidence of autocorrelation','Positive autocorrelation: errors are correlated','Negative autocorrelation: errors alternate','Unequal variance (heteroscedasticity)'], cls);
    return public.mg628_lab_mk('A model''s Durbin–Watson statistic is ' || d::text || '. What does it suggest?', array[cls] || others,
      'Values near 2 mean independent errors; well below 2 suggests positive autocorrelation, well above 2 negative.');
  when 'm4_log' then
    b := round((0.02 + random() * 0.10)::numeric, 3);
    return public.mg628_lab_mk('In a model of log(length of stay), ICU admission has a coefficient of ' || b::text || '. How do you read it?',
      array['About ' || mg628_lab_f(b * 100, 1) || '% longer stays', 'About ' || b::text || '% longer stays', 'About ' || b::text || ' more days', 'About ' || mg628_lab_f(b * 10, 1) || ' more days'],
      'With a log outcome, 100 × coefficient ≈ the percentage change: about ' || mg628_lab_f(b * 100, 1) || '% longer, other predictors held constant.');
  when 'm5_mae', 'm5_rmse' then
    e := array[(5 + floor(random() * 36)) * 100, -(5 + floor(random() * 36)) * 100, (5 + floor(random() * 36)) * 100, -(5 + floor(random() * 36)) * 100];
    mae := (abs(e[1]) + abs(e[2]) + abs(e[3]) + abs(e[4])) / 4;
    rmse := sqrt((e[1]^2 + e[2]^2 + e[3]^2 + e[4]^2) / 4);
    lst := '+$' || mg628_lab_f(e[1]) || ', −$' || mg628_lab_f(-e[2]) || ', +$' || mg628_lab_f(e[3]) || ' and −$' || mg628_lab_f(-e[4]);
    if g = 'm5_mae' then
      return public.mg628_lab_mk('Four test predictions miss by ' || lst || '. What is the mean absolute error (MAE)?',
        array['$' || mg628_lab_f(mae), '$' || mg628_lab_f(rmse), '$' || mg628_lab_f(abs(e[1] + e[2] + e[3] + e[4]) / 4), '$' || mg628_lab_f(mae * 4)],
        'Average the sizes of the misses, ignoring sign: $' || mg628_lab_f(mae) || '.');
    else
      return public.mg628_lab_mk('Four test predictions miss by ' || lst || '. What is the root mean squared error (RMSE)?',
        array['$' || mg628_lab_f(rmse), '$' || mg628_lab_f(mae), '$' || mg628_lab_f(sqrt(e[1]^2 + e[2]^2 + e[3]^2 + e[4]^2)), '$' || mg628_lab_f(rmse^2 / 1000)],
        'Square the misses, average them, take the square root: $' || mg628_lab_f(rmse) || '. RMSE ≥ MAE because big misses weigh more.');
    end if;
  when 'm5_pct' then
    m := (15 + floor(random() * 31)) * 100; d := (25 + floor(random() * 21)) * 1000; c := 100 * m / d;
    return public.mg628_lab_mk('A model''s test MAE is $' || mg628_lab_f(m) || ' and the average monthly revenue per deal is $' || mg628_lab_f(d) || '. About what share of a typical deal does the forecast miss by?',
      array[mg628_lab_f(c, 1) || '%', mg628_lab_f(c / 10, 1) || '%', mg628_lab_f(c * 10, 1) || '%', mg628_lab_f(100 - c, 1) || '%'],
      mg628_lab_f(m) || ' ÷ ' || mg628_lab_f(d) || ' ≈ ' || mg628_lab_f(c, 1) || '%.');
  when 'm5_fit' then
    d := (20 + floor(random() * 15)) * 100;
    if random() < 0.5 then c := round(d * (1.8 + random() * 0.6) / 10) * 10; cls := 'Overfitting: it memorized training noise';
    else c := round(d * (1.02 + random() * 0.06) / 10) * 10; cls := 'It generalizes: test error is close to training error'; end if;
    others := array_remove(array['Overfitting: it memorized training noise','It generalizes: test error is close to training error','Underfitting: it is too simple for the pattern','Multicollinearity among the predictors'], cls);
    return public.mg628_lab_mk('A model has training RMSE $' || mg628_lab_f(d) || ' and test RMSE $' || mg628_lab_f(c) || '. What does this suggest?', array[cls] || others,
      'Compare the two: a test error far above training error signals memorized noise; a small gap means the model carries over to new data.');
  when 'm6_interval' then
    s := (60 + floor(random() * 300)) * 100; c := 172.5 + 0.01546 * s;
    se_m := 166.81 * sqrt(1.0 / 48 + power(s - 16458.4, 2) / 8992627876); se_p := 166.81 * sqrt(1 + 1.0 / 48 + power(s - 16458.4, 2) / 8992627876);
    return public.mg628_lab_mk('You are planning one campaign that will spend $' || mg628_lab_f(s) || ' (Leads = 172.5 + 0.01546 × Spend). Which range should you plan around?',
      array['The 95% prediction interval, ' || mg628_lab_f(greatest(0, c - 2.013 * se_p)) || ' to ' || mg628_lab_f(c + 2.013 * se_p) || ' leads',
            'The 95% confidence interval, ' || mg628_lab_f(c - 2.013 * se_m) || ' to ' || mg628_lab_f(c + 2.013 * se_m) || ' leads',
            'The point forecast alone, ' || mg628_lab_f(c) || ' leads',
            'The slope''s interval, 11.9 to 19.0 leads per $1,000'],
      'One campaign needs the prediction interval, which includes campaign-to-campaign variation. The confidence interval describes the average of many such campaigns.');
  when 'm6_chain' then
    stmts := array[
      array['Spend produces more leads, but each extra lead costs more than the last.','Finding'],
      array['The slope is 15.5 leads per $1,000 (95% CI 11.9 to 19.0).','Evidence'],
      array['The next lead costs about $65, against a $38 average.','Implication'],
      array['Cap extra spend where a lead is worth less than $65, and pilot a reallocation.','Action'],
      array['Budgets may follow the season, so part of the slope could belong to it.','Risk'],
      array['Revenue tracks deal size almost dollar for dollar (coefficient 1.035, p < 0.001).','Evidence'],
      array['Every $1,000 lost per deal costs about $1,035 a month.','Implication'],
      array['Find out why deals are shrinking before reorganizing territories.','Action']];
    k := 1 + floor(random() * 8); cls := stmts[k][2];
    select array_agg(x order by random()) into others from unnest(array_remove(steps, cls)) x;
    return public.mg628_lab_mk('Which step of the recommendation chain does this statement belong to? “' || stmts[k][1] || '”',
      array[cls, others[1], others[2], others[3]],
      'Finding states the result; Evidence gives the numbers; Implication translates them into money, time or service; Action says what to do; Risk names what could make it wrong.');
  else raise exception 'unknown generator %', g;
  end case;
end; $$;

create or replace function public.mg628_lab_item(q public.mg628_lab_questions) returns jsonb
language plpgsql volatile as $$
declare it jsonb; tries int := 0;
begin
  if q.kind = 'static' then return public.mg628_lab_static(q.body) || jsonb_build_object('qid', q.id); end if;
  loop  -- redraw until all four options read differently
    it := public.mg628_lab_gen(q.body->>'gen'); tries := tries + 1;
    exit when (select count(distinct v) from jsonb_array_elements_text(it->'opts') v) = jsonb_array_length(it->'opts') or tries >= 20;
  end loop;
  return it || jsonb_build_object('qid', q.id);
end; $$;


-- ---------- slide watching ----------
-- The browser calls mg628_start_slide when a slide comes on screen and mg628_finish_slide when its last build is reached.
-- A slide counts only if at least 70% of its narration length has passed on the server's clock since it started.
create or replace function public.mg628_start_slide(p_lab text, p_slide int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from mg628_lab_slides where lab = p_lab and slide = p_slide) then raise exception 'unknown slide'; end if;
  insert into mg628_slide_active (user_id, lab, slide, started_at) values (auth.uid(), p_lab, p_slide, now())
  on conflict (user_id) do update set lab = excluded.lab, slide = excluded.slide, started_at = excluded.started_at;
end; $$;

create or replace function public.mg628_finish_slide(p_lab text, p_slide int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); a mg628_slide_active; d numeric; need numeric;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if exists (select 1 from mg628_slide_views where user_id = uid and lab = p_lab and slide = p_slide) then
    return jsonb_build_object('counted', true);
  end if;
  select dur into d from mg628_lab_slides where lab = p_lab and slide = p_slide;
  if d is null then raise exception 'unknown slide'; end if;
  select * into a from mg628_slide_active where user_id = uid;
  if not found or a.lab <> p_lab or a.slide <> p_slide then
    return jsonb_build_object('counted', false, 'reason', 'not_started');
  end if;
  need := 0.7 * d - extract(epoch from (now() - a.started_at));
  if need > 1 then return jsonb_build_object('counted', false, 'reason', 'too_soon', 'seconds_left', ceil(need)); end if;
  insert into mg628_slide_views (user_id, lab, slide) values (uid, p_lab, p_slide) on conflict do nothing;
  return jsonb_build_object('counted', true);
end; $$;

-- ---------- quizzes and warm-ups ----------
create or replace function public.mg628_start_quiz(p_lab text, p_module text, p_kind text default 'quiz')
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); a mg628_attempts; last mg628_attempts; req int; watched int; mods text[]; idx int; wait int;
  qs mg628_lab_questions[]; q mg628_lab_questions; items jsonb := '[]'::jsonb; keys jsonb := '[]'::jsonb; it jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_kind not in ('quiz','retrieval') then raise exception 'bad request'; end if;
  select array_agg(module order by m) into mods from (select module, min(slide) m from mg628_lab_slides where lab = p_lab group by module) x;
  idx := array_position(mods, p_module);
  if idx is null then raise exception 'unknown module'; end if;

  if p_kind = 'retrieval' then
    if idx = 1 then return jsonb_build_object('status','none'); end if;
    select * into a from mg628_attempts where user_id = uid and lab = p_lab and module = p_module and kind = 'retrieval' and submitted_at is not null limit 1;
    if found then return jsonb_build_object('status','done','score',a.score,'n',a.n,'results',a.results,'items',a.items,'answers',a.answers,'late',a.late); end if;
  else
    if exists (select 1 from mg628_attempts where user_id = uid and lab = p_lab and module = p_module and kind = 'quiz' and passed) then
      return jsonb_build_object('status','passed');
    end if;
    select count(*) into req from mg628_lab_slides where lab = p_lab and module = p_module;
    select count(*) into watched from mg628_slide_views v join mg628_lab_slides s on s.lab = v.lab and s.slide = v.slide where v.user_id = uid and v.lab = p_lab and s.module = p_module;
    if watched < req then return jsonb_build_object('status','locked','watched',watched,'required',req); end if;
    select * into last from mg628_attempts where user_id = uid and lab = p_lab and module = p_module and kind = 'quiz' and submitted_at is not null order by submitted_at desc limit 1;
    if found and not coalesce(last.passed, false) and last.submitted_at > now() - interval '3 minutes' then
      wait := ceil(extract(epoch from (last.submitted_at + interval '3 minutes' - now())));
      return jsonb_build_object('status','cooldown','wait_seconds',wait);
    end if;
  end if;

  -- resume an open attempt rather than drawing a new set
  select * into a from mg628_attempts where user_id = uid and lab = p_lab and module = p_module and kind = p_kind and submitted_at is null order by created_at desc limit 1;
  if found then
    return jsonb_build_object('status','open','attempt_id',a.id,'items',a.items);
  end if;

  if p_kind = 'quiz' then
    select coalesce(array_agg(l), '{}') into qs from (
      select l from mg628_lab_questions l where l.lab = p_lab and l.module = p_module and l.kind = 'gen' order by random() limit 2) s;
    select qs || coalesce(array_agg(l), '{}') into qs from (
      select l from mg628_lab_questions l where l.lab = p_lab and l.module = p_module and l.kind = 'static' order by random() limit 5 - coalesce(array_length(qs, 1), 0)) s;
  else
    select array_agg(l) into qs from (
      select l from mg628_lab_questions l where l.lab = p_lab and l.module = any(mods[1:idx-1]) order by random() limit 2) s;
  end if;
  if qs is null or array_length(qs, 1) is null then return jsonb_build_object('status','none'); end if;

  foreach q in array qs loop
    it := public.mg628_lab_item(q);
    items := items || jsonb_build_object('qid', it->>'qid', 'stem', it->>'stem', 'opts', it->'opts');
    keys  := keys  || jsonb_build_object('qid', it->>'qid', 'ans', (it->>'ans')::int, 'why', it->>'why');
  end loop;
  insert into mg628_attempts (user_id, lab, module, kind, items, n) values (uid, p_lab, p_module, p_kind, items, jsonb_array_length(items)) returning * into a;
  insert into mg628_attempt_keys values (a.id, keys);
  return jsonb_build_object('status','open','attempt_id',a.id,'items',a.items);
end; $$;

create or replace function public.mg628_submit_quiz(p_attempt uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); a mg628_attempts; k jsonb; i int; sc int := 0; res jsonb := '[]'::jsonb; ch int; ok boolean; pass boolean; is_late boolean;
begin
  select * into a from mg628_attempts where id = p_attempt and user_id = uid for update;
  if not found then raise exception 'attempt not found'; end if;
  if a.submitted_at is not null then
    return jsonb_build_object('score',a.score,'n',a.n,'passed',a.passed,'results',a.results,'late',a.late);
  end if;
  is_late := false;   -- no time limit
  select keys into k from mg628_attempt_keys where attempt_id = a.id;
  for i in 0..a.n - 1 loop
    ch := case when jsonb_typeof(p_answers->i) = 'number' then (p_answers->>i)::int end;
    ok := ch is not null and ch = (k->i->>'ans')::int;
    if ok then sc := sc + 1; end if;
    res := res || jsonb_build_object('qid', k->i->>'qid', 'stem', left(a.items->i->>'stem', 140), 'chosen', ch,
             'ans', (k->i->>'ans')::int, 'correct', ok, 'why', k->i->>'why');
  end loop;
  pass := case when a.kind = 'quiz' then sc >= ceil(0.8 * a.n) else null end;
  update mg628_attempts set answers = p_answers, results = res, score = sc, passed = pass, late = is_late, submitted_at = now() where id = a.id;
  return jsonb_build_object('score',sc,'n',a.n,'passed',pass,'results',res,'late',is_late);
end; $$;

revoke all on function public.mg628_start_quiz(text, text, text), public.mg628_submit_quiz(uuid, jsonb), public.mg628_start_slide(text, int), public.mg628_finish_slide(text, int) from public, anon;
grant execute on function public.mg628_start_quiz(text, text, text), public.mg628_submit_quiz(uuid, jsonb), public.mg628_start_slide(text, int), public.mg628_finish_slide(text, int) to authenticated;
revoke all on function public.mg628_lab_gen(text), public.mg628_lab_item(public.mg628_lab_questions),
  public.mg628_lab_mk(text, text[], text), public.mg628_lab_static(jsonb) from public, anon, authenticated;

-- 6. Add yourself (and any co-mg628_instructors or TAs) as mg628_instructors:
-- insert into public.mg628_instructors (email) values ('you@yourschool.edu');
