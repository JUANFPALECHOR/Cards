-- Fase 4 · Vocabulario
-- La FK compuesta (set_id, owner_id) impide asociar una palabra a un conjunto de otro usuario.

create table public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  term text not null check (char_length(btrim(term)) between 1 and 200),
  translation text not null check (char_length(btrim(translation)) between 1 and 200),
  example text check (example is null or char_length(example) <= 500),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (set_id, owner_id) references public.study_sets (id, owner_id) on delete cascade
);

comment on table public.vocabulary_items is 'Palabras o expresiones en inglés con su traducción al español.';

create index vocabulary_items_set_created_idx on public.vocabulary_items (set_id, created_at);
create index vocabulary_items_owner_idx on public.vocabulary_items (owner_id);

create trigger vocabulary_items_set_updated_at
  before update on public.vocabulary_items
  for each row execute function public.set_updated_at();

alter table public.vocabulary_items enable row level security;

revoke all on table public.vocabulary_items from anon;
grant select, insert, update, delete on table public.vocabulary_items to authenticated;

create policy "vocabulary_items: owner can select" on public.vocabulary_items
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "vocabulary_items: owner can insert" on public.vocabulary_items
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "vocabulary_items: owner can update" on public.vocabulary_items
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "vocabulary_items: owner can delete" on public.vocabulary_items
  for delete to authenticated using ((select auth.uid()) = owner_id);
