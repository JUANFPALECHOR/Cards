-- Fase 5 · Historial de evaluaciones (flashcards y cuestionarios)
-- Registro inmutable: solo se insertan y consultan filas. Se borran en cascada con la palabra.
--   knew       resultado binario: true = "Lo sabía" / respuesta correcta
--   direction  en_es (inglés → español) | es_en (español → inglés)
--   source     flashcard | quiz
--   mode       srs (modo Repasar: actualiza la programación) | practice (no la altera)

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  knew boolean not null,
  direction text not null check (direction in ('en_es', 'es_en')),
  source text not null check (source in ('flashcard', 'quiz')),
  mode text not null check (mode in ('srs', 'practice')),
  reviewed_at timestamptz not null default now(),
  foreign key (item_id, owner_id) references public.vocabulary_items (id, owner_id) on delete cascade
);

comment on table public.review_events is 'Historial de aciertos y errores por palabra.';

create index review_events_owner_reviewed_idx on public.review_events (owner_id, reviewed_at desc);
create index review_events_item_reviewed_idx on public.review_events (item_id, reviewed_at desc);

alter table public.review_events enable row level security;

revoke all on table public.review_events from anon;
grant select, insert on table public.review_events to authenticated;

create policy "review_events: owner can select" on public.review_events
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "review_events: owner can insert" on public.review_events
  for insert to authenticated with check ((select auth.uid()) = owner_id);
