/*
  # Posição e atributos das imagens inline

  A extração passa a registrar, para cada imagem do corpo da matéria,
  quantos blocos de texto a precedem (posicao) e os atributos originais
  da tag <img> (atributos). Com isso a exportação consegue reinserir as
  imagens no lugar certo do bodyRichText, no formato de importação do Strapi.

  Linhas antigas ficam com posicao NULL: a exportação as anexa ao fim do corpo.
*/

ALTER TABLE imagens ADD COLUMN IF NOT EXISTS posicao int;
ALTER TABLE imagens ADD COLUMN IF NOT EXISTS atributos jsonb;

COMMENT ON COLUMN imagens.posicao IS 'Quantidade de blocos de texto (p, h1-h6, ul, ol, blockquote) que precedem a imagem no corpo da materia; NULL = desconhecida';
COMMENT ON COLUMN imagens.atributos IS 'Atributos originais da tag <img>: alt, width, height, srcset, sizes';
