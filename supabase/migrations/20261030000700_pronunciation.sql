-- Pronunciación aproximada para hispanohablantes (opcional, escrita a mano, sin IPA).
-- Ejemplo: «TRÁ-bol-shú-ting»; la sílaba acentuada va en mayúsculas.
-- La cola de Repasar (get_review_queue) no cambia: el cliente lee la pronunciación aparte.
alter table public.vocabulary_items
  add column pronunciation_es text
  constraint vocabulary_items_pronunciation_es_length
    check (pronunciation_es is null or char_length(pronunciation_es) between 1 and 100);
