-- Aprendizaje adaptativo: dominio actual, retención comprobada y repetición espaciada.
-- El algoritmo vive en el frontend (src/app/features/spaced-repetition/domain/learning-state.ts);
-- la base de datos guarda cada intento y el estado resultante de forma atómica e idempotente.
-- Cambios no destructivos: se añaden columnas, índices y funciones; no se borra ningún dato.

-- ---------------------------------------------------------------------------------------------
-- Historial de intentos
-- ---------------------------------------------------------------------------------------------
--   grade              again («No la sabía») | hard («Me costó») | good («La sabía»)
--   question_type      self_assessment (flashcard) | multiple_choice | written; null si no se registró
--   client_attempt_id  id generado por el cliente: un reenvío del mismo intento no se duplica
--   status_after       estado de la palabra tras el intento (historial de aprendizaje)

alter table public.review_events
  add column grade text,
  add column question_type text
    constraint review_events_question_type_check
      check (question_type in ('self_assessment', 'multiple_choice', 'written')),
  add column client_attempt_id uuid,
  add column status_after text
    constraint review_events_status_after_check
      check (status_after in ('learning', 'difficult', 'provisional', 'learned'));

-- Los intentos anteriores eran binarios («Lo sabía» / «No lo sabía»): no se reescriben. Su grado se
-- deduce de `knew` (grade null ⇒ good si knew, again si no) y el tipo de pregunta de `source`.
alter table public.review_events
  add constraint review_events_grade_check check (grade in ('again', 'hard', 'good')),
  add constraint review_events_grade_matches_knew check (grade is null or knew = (grade <> 'again'));

create unique index review_events_owner_attempt_key
  on public.review_events (owner_id, client_attempt_id)
  where client_attempt_id is not null;

comment on column public.review_events.grade is 'again = No la sabía · hard = Me costó · good = La sabía.';
comment on column public.review_events.client_attempt_id is 'Idempotencia: el mismo intento reenviado no se registra dos veces.';

-- ---------------------------------------------------------------------------------------------
-- Estado de aprendizaje (una fila por palabra practicada; sin fila = palabra nueva)
-- ---------------------------------------------------------------------------------------------
-- box (Leitner) queda como nivel aproximado derivado del estado: 1 aprendizaje/difícil, 3 dominada, 4 aprendida.

alter table public.review_states
  add column status text not null default 'learning'
    constraint review_states_status_check
      check (status in ('learning', 'difficult', 'provisional', 'learned')),
  add column mastery smallint not null default 0
    constraint review_states_mastery_check check (mastery between 0 and 100),
  add column difficulty smallint not null default 0
    constraint review_states_difficulty_check check (difficulty between 0 and 100),
  add column attempts integer not null default 0 check (attempts >= 0),
  add column successes integer not null default 0 check (successes >= 0),
  add column failures integer not null default 0 check (failures >= 0),
  add column hard_count integer not null default 0 check (hard_count >= 0),
  add column streak integer not null default 0 check (streak >= 0),
  add column streak_points numeric(7, 2) not null default 0 check (streak_points >= 0),
  add column streak_started_at timestamptz,
  add column retention_points numeric(7, 2) not null default 0 check (retention_points >= 0),
  add column recent text not null default ''
    constraint review_states_recent_check check (recent ~ '^[agh]{0,20}$'),
  add column lapses integer not null default 0 check (lapses >= 0),
  add column en_es_attempts integer not null default 0 check (en_es_attempts >= 0),
  add column en_es_failures integer not null default 0 check (en_es_failures >= 0),
  add column es_en_attempts integer not null default 0 check (es_en_attempts >= 0),
  add column es_en_failures integer not null default 0 check (es_en_failures >= 0),
  add column interval_minutes integer not null default 0 check (interval_minutes >= 0),
  add column provisional_at timestamptz,
  add column learned_at timestamptz,
  add column version integer not null default 0 check (version >= 0);

comment on table public.review_states is 'Estado de aprendizaje adaptativo y programación SRS de cada palabra.';
comment on column public.review_states.version is 'Control de concurrencia optimista entre pestañas o dispositivos.';

create index review_states_owner_status_idx on public.review_states (owner_id, status);
create index review_states_owner_difficulty_idx on public.review_states (owner_id, difficulty desc);

-- ---------------------------------------------------------------------------------------------
-- Registrar un intento: historial + nuevo estado en una sola transacción.
-- ---------------------------------------------------------------------------------------------
-- Devuelve:
--   recorded   se guardó el intento y el estado.
--   duplicate  ese intento ya estaba registrado (reenvío): no se cambia nada.
--   conflict   otra pestaña o dispositivo actualizó la palabra antes: el cliente relee y recalcula.
-- security invoker: RLS impide leer o escribir palabras de otros usuarios.

create or replace function public.record_learning_attempt(
  p_attempt_id uuid,
  p_item_id uuid,
  p_grade text,
  p_direction text,
  p_source text,
  p_mode text,
  p_question_type text,
  p_expected_version integer,
  p_state jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_version integer;
begin
  if v_owner is null then
    raise exception 'Se requiere una sesión.' using errcode = '28000';
  end if;

  -- Serializa los intentos de una misma palabra.
  perform pg_advisory_xact_lock(hashtextextended('learning:' || p_item_id::text, 0));

  if exists (
    select 1 from public.review_events e
    where e.owner_id = v_owner and e.client_attempt_id = p_attempt_id
  ) then
    return 'duplicate';
  end if;

  select r.version into v_version from public.review_states r where r.item_id = p_item_id;
  if coalesce(v_version, 0) <> p_expected_version then
    return 'conflict';
  end if;

  insert into public.review_states as r (
    item_id, box, status, mastery, difficulty, attempts, successes, failures, hard_count,
    streak, streak_points, streak_started_at, retention_points, recent, lapses,
    en_es_attempts, en_es_failures, es_en_attempts, es_en_failures,
    interval_minutes, due_at, last_reviewed_at, provisional_at, learned_at, version
  )
  values (
    p_item_id,
    case p_state ->> 'status' when 'learned' then 4 when 'provisional' then 3 else 1 end,
    p_state ->> 'status',
    (p_state ->> 'mastery')::smallint,
    (p_state ->> 'difficulty')::smallint,
    (p_state ->> 'attempts')::integer,
    (p_state ->> 'successes')::integer,
    (p_state ->> 'failures')::integer,
    (p_state ->> 'hard_count')::integer,
    (p_state ->> 'streak')::integer,
    (p_state ->> 'streak_points')::numeric,
    (p_state ->> 'streak_started_at')::timestamptz,
    (p_state ->> 'retention_points')::numeric,
    p_state ->> 'recent',
    (p_state ->> 'lapses')::integer,
    (p_state ->> 'en_es_attempts')::integer,
    (p_state ->> 'en_es_failures')::integer,
    (p_state ->> 'es_en_attempts')::integer,
    (p_state ->> 'es_en_failures')::integer,
    (p_state ->> 'interval_minutes')::integer,
    (p_state ->> 'due_at')::timestamptz,
    (p_state ->> 'last_reviewed_at')::timestamptz,
    (p_state ->> 'provisional_at')::timestamptz,
    (p_state ->> 'learned_at')::timestamptz,
    1
  )
  on conflict (item_id) do update set
    box = excluded.box,
    status = excluded.status,
    mastery = excluded.mastery,
    difficulty = excluded.difficulty,
    attempts = excluded.attempts,
    successes = excluded.successes,
    failures = excluded.failures,
    hard_count = excluded.hard_count,
    streak = excluded.streak,
    streak_points = excluded.streak_points,
    streak_started_at = excluded.streak_started_at,
    retention_points = excluded.retention_points,
    recent = excluded.recent,
    lapses = excluded.lapses,
    en_es_attempts = excluded.en_es_attempts,
    en_es_failures = excluded.en_es_failures,
    es_en_attempts = excluded.es_en_attempts,
    es_en_failures = excluded.es_en_failures,
    interval_minutes = excluded.interval_minutes,
    due_at = excluded.due_at,
    last_reviewed_at = excluded.last_reviewed_at,
    provisional_at = excluded.provisional_at,
    learned_at = excluded.learned_at,
    version = r.version + 1;

  insert into public.review_events (
    item_id, knew, grade, direction, source, mode, question_type, client_attempt_id, status_after
  )
  values (
    p_item_id, p_grade <> 'again', p_grade, p_direction, p_source, p_mode, p_question_type,
    p_attempt_id, p_state ->> 'status'
  );

  return 'recorded';
end;
$$;

revoke all on function public.record_learning_attempt(uuid, uuid, text, text, text, text, text, integer, jsonb)
  from public, anon;
grant execute on function public.record_learning_attempt(uuid, uuid, text, text, text, text, text, integer, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Candidatos de cada modo de Repasar. El orden y los límites finales los decide el frontend
-- (review-queue.ts), así hay una sola fuente de verdad para las prioridades.
-- ---------------------------------------------------------------------------------------------
--   smart      pendientes (due_at <= now) + hasta p_new_limit palabras nuevas
--   difficult  difíciles o con algún fallo
--   learned    aprendidas

create or replace function public.get_study_queue(p_mode text, p_new_limit integer default 20)
returns table (
  item_id uuid,
  set_id uuid,
  set_name text,
  term text,
  translation text,
  example text,
  pronunciation text,
  state jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  (
    select v.id, v.set_id, s.name, v.term, v.translation, v.example, v.pronunciation_es, to_jsonb(r)
    from public.review_states r
    join public.vocabulary_items v on v.id = r.item_id
    join public.study_sets s on s.id = v.set_id
    where (p_mode = 'smart' and r.due_at <= now())
       or (p_mode = 'difficult' and (r.status = 'difficult' or r.failures > 0))
       or (p_mode = 'learned' and r.status = 'learned')
  )
  union all
  (
    select v.id, v.set_id, s.name, v.term, v.translation, v.example, v.pronunciation_es, null::jsonb
    from public.vocabulary_items v
    join public.study_sets s on s.id = v.set_id
    where p_mode = 'smart'
      and not exists (select 1 from public.review_states r where r.item_id = v.id)
    order by v.created_at
    limit greatest(p_new_limit, 0)
  );
$$;

revoke all on function public.get_study_queue(text, integer) from public, anon;
grant execute on function public.get_study_queue(text, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Resumen de Progreso y Repasar en una sola consulta. Cada palabra pertenece a un único estado:
-- new_items + learning + difficult + provisional + learned = total_items.
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_learning_overview(p_time_zone text)
returns table (
  total_items integer,
  new_items integer,
  learning_items integer,
  difficult_items integer,
  provisional_items integer,
  learned_items integer,
  due_now integer,
  due_today integer,
  due_tomorrow integer,
  due_week integer,
  next_due_at timestamptz,
  total_answers integer,
  correct_answers integer,
  hard_answers integer,
  mastered_today integer,
  learned_today integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with local_day as (
    select date_trunc('day', now() at time zone p_time_zone) as today
  ),
  bounds as (
    select
      today at time zone p_time_zone as today_start,
      (today + interval '1 day') at time zone p_time_zone as tomorrow_start,
      (today + interval '2 days') at time zone p_time_zone as after_tomorrow_start,
      (today + interval '8 days') at time zone p_time_zone as week_end
    from local_day
  )
  select
    (select count(*) from public.vocabulary_items)::integer,
    (select count(*) from public.vocabulary_items v
      where not exists (select 1 from public.review_states r where r.item_id = v.id))::integer,
    (select count(*) from public.review_states where status = 'learning')::integer,
    (select count(*) from public.review_states where status = 'difficult')::integer,
    (select count(*) from public.review_states where status = 'provisional')::integer,
    (select count(*) from public.review_states where status = 'learned')::integer,
    (select count(*) from public.review_states where due_at <= now())::integer,
    (select count(*) from public.review_states, bounds where due_at < tomorrow_start)::integer,
    (select count(*) from public.review_states, bounds
      where due_at >= tomorrow_start and due_at < after_tomorrow_start)::integer,
    (select count(*) from public.review_states, bounds where due_at < week_end)::integer,
    (select min(due_at) from public.review_states where due_at > now()),
    (select count(*) from public.review_events)::integer,
    (select count(*) from public.review_events where knew)::integer,
    (select count(*) from public.review_events where grade = 'hard')::integer,
    (select count(*) from public.review_states, bounds
      where status in ('provisional', 'learned') and provisional_at >= today_start)::integer,
    (select count(*) from public.review_states, bounds
      where status = 'learned' and learned_at >= today_start)::integer;
$$;

revoke all on function public.get_learning_overview(text) from public, anon;
grant execute on function public.get_learning_overview(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Evolución semanal (semanas de lunes a domingo en la zona horaria del usuario).
--   mastered  palabras que pasaron a dominadas (provisional o aprendida) esa semana
--   learned   palabras que pasaron a aprendidas esa semana
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_weekly_progress(p_time_zone text, p_weeks integer default 8)
returns table (
  week_start date,
  answers integer,
  correct integer,
  mastered integer,
  learned integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      (date_trunc('week', now() at time zone p_time_zone))::date as this_week,
      least(greatest(p_weeks, 1), 26) as weeks
  ),
  weeks as (
    select (p.this_week - 7 * g)::date as week_start
    from params p, generate_series(0, (select weeks from params) - 1) as g
  ),
  events as (
    select
      e.item_id,
      e.knew,
      e.status_after,
      lag(e.status_after) over (partition by e.item_id order by e.reviewed_at) as status_before,
      (date_trunc('week', e.reviewed_at at time zone p_time_zone))::date as week_start
    from public.review_events e
  )
  select
    w.week_start,
    count(ev.item_id)::integer,
    (count(ev.item_id) filter (where ev.knew))::integer,
    (count(distinct ev.item_id) filter (
      where ev.status_after in ('provisional', 'learned')
        and coalesce(ev.status_before, 'none') not in ('provisional', 'learned')
    ))::integer,
    (count(distinct ev.item_id) filter (
      where ev.status_after = 'learned' and coalesce(ev.status_before, 'none') <> 'learned'
    ))::integer
  from weeks w
  left join events ev on ev.week_start = w.week_start
  group by w.week_start
  order by w.week_start;
$$;

revoke all on function public.get_weekly_progress(text, integer) from public, anon;
grant execute on function public.get_weekly_progress(text, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- record_srs_review y get_review_queue (versión Leitner) quedan sin uso en el frontend. No se
-- eliminan ni se modifican sus permisos en esta migración.
-- ---------------------------------------------------------------------------------------------
