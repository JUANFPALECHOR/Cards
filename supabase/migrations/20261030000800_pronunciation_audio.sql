-- Audios de pronunciación generados con ElevenLabs y guardados en Storage.
-- Una fila por combinación de texto + voz + modelo + formato (cache_key = sha256 de todo ello).
-- La tabla cumple tres funciones: índice de la caché, bloqueo contra generaciones duplicadas
-- y registro de consumo para los límites. Solo la usa la Edge Function `pronounce`
-- (clave secreta); los clientes no tienen ningún permiso sobre ella.
create table public.pronunciation_audio (
  cache_key text primary key check (cache_key ~ '^[0-9a-f]{64}$'),
  storage_path text not null unique,
  -- Texto enviado a ElevenLabs: permite auditar qué consumió créditos.
  text text not null check (char_length(text) between 1 and 200),
  voice_id text not null,
  model_id text not null,
  characters integer not null check (characters > 0),
  -- Créditos que informó ElevenLabs al generar (si los devuelve).
  provider_cost integer check (provider_cost is null or provider_cost >= 0),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index pronunciation_audio_created_by_idx
  on public.pronunciation_audio (created_by, created_at);
create index pronunciation_audio_created_at_idx
  on public.pronunciation_audio (created_at);

alter table public.pronunciation_audio enable row level security;
-- Sin políticas: anon y authenticated no pueden leer ni escribir (RLS + sin privilegios).
revoke all on table public.pronunciation_audio from public, anon, authenticated;

-- Reserva atómica de una generación. Devuelve:
--   'ready'         ya existe el audio: reutilizarlo, sin gastar créditos;
--   'pending'       otra petición lo está generando ahora mismo: reintentar en unos segundos;
--   'daily-limit'   el usuario alcanzó su límite de audios nuevos en las últimas 24 h;
--   'monthly-limit' se alcanzaría el límite global de caracteres del mes;
--   'claimed'       esta petición debe generarlo (la fila queda en 'pending').
-- El bloqueo consultivo serializa las reservas: los límites no se superan con peticiones simultáneas.
create function public.claim_pronunciation_audio(
  p_cache_key text,
  p_storage_path text,
  p_text text,
  p_voice_id text,
  p_model_id text,
  p_user_id uuid,
  p_daily_limit integer,
  p_monthly_char_limit integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_created_at timestamptz;
  v_daily integer;
  v_monthly integer;
  v_exists boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pronunciation_audio_claim', 0));

  select status, created_at into v_status, v_created_at
  from public.pronunciation_audio
  where cache_key = p_cache_key;
  -- FOUND cambia con cada SELECT INTO: se guarda ahora.
  v_exists := found;

  if v_exists then
    if v_status = 'ready' then
      return 'ready';
    end if;
    if v_created_at > now() - interval '60 seconds' then
      return 'pending';
    end if;
    -- Si llega aquí, es una reserva abandonada (la petición original falló sin liberarla).
  end if;

  select count(*) into v_daily
  from public.pronunciation_audio
  where created_by = p_user_id and created_at > now() - interval '24 hours';
  if v_daily >= p_daily_limit then
    return 'daily-limit';
  end if;

  -- Una reserva abandonada ya está contada en el mes: retomarla no suma caracteres.
  select coalesce(sum(characters), 0) into v_monthly
  from public.pronunciation_audio
  where created_at >= date_trunc('month', now());
  if v_monthly + (case when v_exists then 0 else char_length(p_text) end) > p_monthly_char_limit then
    return 'monthly-limit';
  end if;

  if v_exists then
    update public.pronunciation_audio
    set created_by = p_user_id, created_at = now(), completed_at = null
    where cache_key = p_cache_key;
  else
    insert into public.pronunciation_audio
      (cache_key, storage_path, text, voice_id, model_id, characters, created_by)
    values
      (p_cache_key, p_storage_path, p_text, p_voice_id, p_model_id, char_length(p_text), p_user_id);
  end if;
  return 'claimed';
end;
$$;

revoke all on function public.claim_pronunciation_audio(text, text, text, text, text, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_pronunciation_audio(text, text, text, text, text, uuid, integer, integer)
  to service_role;

-- Bucket privado: sin políticas de Storage, solo la Edge Function (clave secreta) escribe y
-- firma URLs temporales de lectura. Solo MP3 y como máximo 1 MB por archivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pronunciations', 'pronunciations', false, 1048576, array['audio/mpeg'])
on conflict (id) do nothing;
