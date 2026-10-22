/*
  # Alinhamento do corpo e legendas por idioma

  1. Colunas novas
    - `noticias.alinhamento_corpo` (text): alinhamento dominante dos paragrafos
      na materia em portugues ("justify", "center", "right"); nulo = padrao.
      E por materia, nao por paragrafo: a contagem de paragrafos nao bate entre
      os idiomas, entao nao da para mapear um a um.
    - `imagens.caption_en` / `imagens.caption_es` (text): legenda traduzida.
      Nulo = cai na legenda em portugues.

  2. Observacoes
    - Linhas antigas ficam nulas; so vale para o que for extraido daqui pra
      frente.
*/

ALTER TABLE noticias ADD COLUMN IF NOT EXISTS alinhamento_corpo text;
ALTER TABLE imagens ADD COLUMN IF NOT EXISTS caption_en text;
ALTER TABLE imagens ADD COLUMN IF NOT EXISTS caption_es text;

COMMENT ON COLUMN noticias.alinhamento_corpo IS 'Alinhamento dominante dos paragrafos na materia em portugues; nulo = padrao';
COMMENT ON COLUMN imagens.caption_en IS 'Legenda traduzida para ingles; nulo = usa a legenda em portugues';
COMMENT ON COLUMN imagens.caption_es IS 'Legenda traduzida para espanhol; nulo = usa a legenda em portugues';
