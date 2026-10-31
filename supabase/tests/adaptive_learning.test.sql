-- Pruebas de record_learning_attempt y del aislamiento entre usuarios.
-- Se ejecutan contra la base de datos real dentro de un bloque que SIEMPRE se revierte: el último
-- `raise exception` deshace todo y su mensaje es el resultado («OK: …» o el fallo).
-- Requiere al menos una palabra existente (se usa la más antigua).

do $$
declare
  v_item uuid;
  v_owner uuid;
  v_attempt uuid := gen_random_uuid();
  v_result text;
  v_count integer;
  v_state jsonb := jsonb_build_object(
    'status', 'learning', 'mastery', 28, 'difficulty', 4, 'attempts', 1, 'successes', 1,
    'failures', 0, 'hard_count', 0, 'streak', 1, 'streak_points', 0.8,
    'streak_started_at', now(), 'retention_points', 0, 'recent', 'g', 'lapses', 0,
    'en_es_attempts', 1, 'en_es_failures', 0, 'es_en_attempts', 0, 'es_en_failures', 0,
    'interval_minutes', 60, 'due_at', now() + interval '1 hour', 'last_reviewed_at', now(),
    'provisional_at', null, 'learned_at', null
  );
  v_version integer;
begin
  select id, owner_id into v_item, v_owner from public.vocabulary_items order by created_at limit 1;
  if v_item is null then
    raise exception 'SKIP: no hay palabras para probar';
  end if;

  -- Actuar como el dueño de la palabra (rol authenticated + JWT simulado).
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select coalesce((select version from public.review_states where item_id = v_item), 0) into v_version;

  -- 1. Registro normal.
  v_result := public.record_learning_attempt(
    v_attempt, v_item, 'good', 'en_es', 'flashcard', 'practice', 'self_assessment', v_version, v_state);
  if v_result <> 'recorded' then raise exception 'FALLO 1: %', v_result; end if;

  -- 2. Reenvío del mismo intento: no se duplica.
  v_result := public.record_learning_attempt(
    v_attempt, v_item, 'good', 'en_es', 'flashcard', 'practice', 'self_assessment', v_version + 1, v_state);
  if v_result <> 'duplicate' then raise exception 'FALLO 2: %', v_result; end if;
  select count(*) into v_count from public.review_events where client_attempt_id = v_attempt;
  if v_count <> 1 then raise exception 'FALLO 2b: % eventos', v_count; end if;

  -- 3. Versión desactualizada (otra pestaña escribió antes): conflicto, sin escribir nada.
  v_result := public.record_learning_attempt(
    gen_random_uuid(), v_item, 'again', 'en_es', 'flashcard', 'practice', 'self_assessment', v_version, v_state);
  if v_result <> 'conflict' then raise exception 'FALLO 3: %', v_result; end if;

  -- 4. Estado y evento coherentes.
  select version into v_count from public.review_states where item_id = v_item;
  if v_count <> v_version + 1 then raise exception 'FALLO 4: versión %', v_count; end if;
  if not exists (
    select 1 from public.review_events
    where client_attempt_id = v_attempt and grade = 'good' and knew and status_after = 'learning'
  ) then raise exception 'FALLO 4b: evento incompleto'; end if;

  -- 5. Otro usuario no ve ni puede modificar el progreso ajeno.
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-000000000099', 'role', 'authenticated')::text, true);
  select count(*) into v_count from public.review_states where item_id = v_item;
  if v_count <> 0 then raise exception 'FALLO 5: el otro usuario ve el estado'; end if;
  select count(*) into v_count from public.review_events where item_id = v_item;
  if v_count <> 0 then raise exception 'FALLO 5b: el otro usuario ve el historial'; end if;
  select total_items into v_count from public.get_learning_overview('America/Bogota');
  if v_count <> 0 then raise exception 'FALLO 5c: el resumen incluye palabras ajenas'; end if;
  begin
    v_result := public.record_learning_attempt(
      gen_random_uuid(), v_item, 'again', 'en_es', 'flashcard', 'practice', 'self_assessment', 0, v_state);
    raise exception 'FALLO 5d: el otro usuario pudo escribir (%)', v_result;
  exception
    when insufficient_privilege or foreign_key_violation or check_violation then null;
  end;

  -- 6. Sin sesión no se registra nada.
  perform set_config('request.jwt.claims', '', true);
  begin
    v_result := public.record_learning_attempt(
      gen_random_uuid(), v_item, 'good', 'en_es', 'flashcard', 'practice', 'self_assessment', 0, v_state);
    raise exception 'FALLO 6: sin sesión se registró (%)', v_result;
  exception
    when invalid_authorization_specification then null;
  end;

  raise exception 'OK: 6 comprobaciones superadas (cambios revertidos)';
end;
$$;
