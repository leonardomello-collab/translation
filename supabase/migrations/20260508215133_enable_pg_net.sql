/*
  # Habilitar extensão pg_net

  ## Descrição
  Habilita a extensão pg_net para permitir chamadas HTTP a partir do Postgres.
  Necessária para acionar a Edge Function de processamento de notícias via SQL
  durante testes e automações.

  ## 1. Mudanças
  - Habilita a extensão `pg_net` no schema `extensions`.

  ## 2. Segurança
  - A extensão é disponibilizada globalmente, mas só pode ser usada através dos
    helpers expostos (net.http_post / net.http_get). Não há exposição de dados
    sensíveis.
*/

CREATE EXTENSION IF NOT EXISTS pg_net;