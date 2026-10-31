-- Fase 3 · Conjuntos de estudio
-- Cada fila pertenece a un usuario de Supabase Auth (sesión anónima invisible por ahora).
-- RLS: cada usuario solo ve y modifica sus propios datos. No existen políticas para el rol anon.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.study_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Permite claves foráneas compuestas (id, owner_id) que garantizan que los hijos
  -- pertenecen al mismo propietario que el conjunto.
  unique (id, owner_id)
);

comment on table public.study_sets is 'Conjuntos de estudio de vocabulario.';

-- Nombre único por propietario, sin distinguir mayúsculas ni espacios exteriores.
create unique index study_sets_owner_name_key on public.study_sets (owner_id, lower(btrim(name)));
create index study_sets_owner_updated_idx on public.study_sets (owner_id, updated_at desc);

create trigger study_sets_set_updated_at
  before update on public.study_sets
  for each row execute function public.set_updated_at();

alter table public.study_sets enable row level security;

revoke all on table public.study_sets from anon;
grant select, insert, update, delete on table public.study_sets to authenticated;

create policy "study_sets: owner can select" on public.study_sets
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "study_sets: owner can insert" on public.study_sets
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "study_sets: owner can update" on public.study_sets
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "study_sets: owner can delete" on public.study_sets
  for delete to authenticated using ((select auth.uid()) = owner_id);
