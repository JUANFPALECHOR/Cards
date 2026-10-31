-- Fase 8 · Progreso
-- Días con actividad de estudio en la zona horaria del usuario (para calcular la racha).
-- Devuelve como máximo los días distintos del último año, del más reciente al más antiguo.

create or replace function public.get_study_days(p_time_zone text)
returns table (study_day date)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct (e.reviewed_at at time zone p_time_zone)::date as study_day
  from public.review_events e
  where e.reviewed_at >= now() - interval '400 days'
  order by study_day desc
  limit 400;
$$;

revoke all on function public.get_study_days(text) from public, anon;
grant execute on function public.get_study_days(text) to authenticated;
