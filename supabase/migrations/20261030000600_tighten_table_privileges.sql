-- Fase 9 · Endurecimiento de privilegios
-- Los privilegios por defecto del esquema public conceden ALL al rol authenticated
-- (incluido TRUNCATE, que no respeta RLS). Se dejan solo las operaciones que usa la aplicación.

revoke all on table
  public.study_sets,
  public.vocabulary_items,
  public.review_events,
  public.review_states
from authenticated, anon;

grant select, insert, update, delete on table public.study_sets to authenticated;
grant select, insert, update, delete on table public.vocabulary_items to authenticated;
-- Historial inmutable.
grant select, insert on table public.review_events to authenticated;
-- El estado SRS se crea y actualiza; se borra en cascada con la palabra.
grant select, insert, update on table public.review_states to authenticated;

-- La función de trigger no debe poder invocarse desde la API.
revoke all on function public.set_updated_at() from public, anon, authenticated;
