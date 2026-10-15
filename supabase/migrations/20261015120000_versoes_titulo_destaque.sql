/*
  # Titulo de destaque por idioma

  O CMS ganhou o campo "Titulo de destaque" (highlightTitle em
  api::noticia.noticia): titulo curto usado nos banners automaticos.

  1. Nova coluna
    - `versoes.titulo_destaque` (text, nulo): versao curta do titulo no idioma
      da linha. Nulo/vazio = o CMS usa o titulo normal no banner.

  2. Observacoes
    - Linhas antigas ficam nulas; so o que for extraido de agora em diante
      recebe valor.
*/

ALTER TABLE versoes ADD COLUMN IF NOT EXISTS titulo_destaque text;

COMMENT ON COLUMN versoes.titulo_destaque IS 'Titulo curto para banner (highlightTitle no CMS); nulo = usa o titulo normal';
