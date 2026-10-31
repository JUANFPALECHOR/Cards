-- Fase 7 · Estado actual de repetición espaciada (una fila por palabra repasada en modo Repasar)
-- El algoritmo vive en el frontend (src/app/features/spaced-repetition/domain); aquí solo se guarda
-- su resultado. Una palabra sin fila se considera "nueva".

create table public.review_states (
  item_id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  box smallint not null check (box between 1 and 5),
  due_at timestamptz not null,
  last_reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (item_id, owner_id) references public.vocabulary_items (id, owner_id) on delete cascade
);

comment on table public.review_states is 'Programación SRS (Leitner) de cada palabra.';

create index review_states_owner_due_idx on public.review_states (owner_id, due_at);
create index review_states_owner_box_idx on public.review_states (owner_id, box);

create trigger review_states_set_updated_at
  before update on public.review_states
  for each row execute function public.set_updated_at();

alter table public.review_states enable row level security;

revoke all on table public.review_states from anon;
grant select, insert, update on table public.review_states to authenticated;

create policy "review_states: owner can select" on public.review_states
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "review_states: owner can insert" on public.review_states
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "review_states: owner can update" on public.review_states
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Registra una respuesta del modo Repasar de forma atómica: evento + nuevo estado.
-- security invoker: se ejecuta con los permisos y políticas RLS del usuario que llama.
create or replace function public.record_srs_review(
  p_item_id uuid,
  p_knew boolean,
  p_direction text,
  p_box smallint,
  p_due_at timestamptz
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.review_events (item_id, knew, direction, source, mode)
  values (p_item_id, p_knew, p_direction, 'flashcard', 'srs');

  insert into public.review_states (item_id, box, due_at, last_reviewed_at)
  values (p_item_id, p_box, p_due_at, now())
  on conflict (item_id) do update
    set box = excluded.box,
        due_at = excluded.due_at,
        last_reviewed_at = excluded.last_reviewed_at;
$$;

revoke all on function public.record_srs_review(uuid, boolean, text, smallint, timestamptz)
  from public, anon;
grant execute on function public.record_srs_review(uuid, boolean, text, smallint, timestamptz)
  to authenticated;

-- Cola del modo Repasar: palabras vencidas (más antiguas primero) y después palabras nuevas.
create or replace function public.get_review_queue(p_new_limit integer default 20)
returns table (
  item_id uuid,
  set_id uuid,
  set_name text,
  term text,
  translation text,
  example text,
  box smallint,
  due_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  (
    select v.id, v.set_id, s.name, v.term, v.translation, v.example, r.box, r.due_at
    from public.review_states r
    join public.vocabulary_items v on v.id = r.item_id
    join public.study_sets s on s.id = v.set_id
    where r.due_at <= now()
    order by r.due_at
  )
  union all
  (
    select v.id, v.set_id, s.name, v.term, v.translation, v.example, null::smallint, null::timestamptz
    from public.vocabulary_items v
    join public.study_sets s on s.id = v.set_id
    where not exists (select 1 from public.review_states r where r.item_id = v.id)
    order by v.created_at
    limit greatest(p_new_limit, 0)
  );
$$;

revoke all on function public.get_review_queue(integer) from public, anon;
grant execute on function public.get_review_queue(integer) to authenticated;
