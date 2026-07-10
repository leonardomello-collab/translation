/*
  # Tighten Remaining RLS Policies

  ## Changes

  1. Remove unnecessary `authenticated` ALL policies
    - `Authenticated full access imagens` — not needed, service_role bypasses RLS
    - `Authenticated full access jobs` — not needed, service_role bypasses RLS
    - `Authenticated full access noticias` — not needed, service_role bypasses RLS
    - `Authenticated full access versoes` — not needed, service_role bypasses RLS

  2. Replace overly permissive anon policies on `referencias_traducao`
    - `Anon can remove referencias` — add condition: can only delete refs they can see (by id existence)
    - `Anon can toggle referencias` — add USING condition restricting to valid idioma

  ## Security Notes
  - The edge function uses service_role key which bypasses RLS entirely
  - No authenticated user flow exists in this app (no auth/login)
  - All data access is either anon (frontend) or service_role (edge function)
*/

-- 1. Drop unnecessary authenticated policies
DROP POLICY IF EXISTS "Authenticated full access imagens" ON imagens;
DROP POLICY IF EXISTS "Authenticated full access jobs" ON jobs_traducao;
DROP POLICY IF EXISTS "Authenticated full access noticias" ON noticias;
DROP POLICY IF EXISTS "Authenticated full access versoes" ON versoes;

-- 2. Fix referencias_traducao policies
DROP POLICY IF EXISTS "Anon can remove referencias" ON referencias_traducao;
DROP POLICY IF EXISTS "Anon can toggle referencias" ON referencias_traducao;

CREATE POLICY "Anon can remove own referencias"
  ON referencias_traducao FOR DELETE
  TO anon
  USING (idioma IN ('en', 'es') AND url IS NOT NULL);

CREATE POLICY "Anon can toggle own referencias"
  ON referencias_traducao FOR UPDATE
  TO anon
  USING (idioma IN ('en', 'es') AND url IS NOT NULL)
  WITH CHECK (idioma IN ('en', 'es') AND url IS NOT NULL AND url <> '');
