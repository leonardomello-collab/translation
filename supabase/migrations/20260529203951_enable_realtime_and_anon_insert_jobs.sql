/*
  # Enable Realtime and Allow Anon to Insert Jobs

  ## Changes

  1. Add `jobs_traducao` and `noticias` to supabase_realtime publication
    - Enables real-time updates in the UI when jobs change status
    - Enables real-time updates when new noticias are created

  2. Add RLS policy for anon to INSERT into `jobs_traducao`
    - Allows the frontend to insert jobs in bulk with status 'fila'
    - Restricted: can only insert with status = 'fila'

  ## Security Notes
  - Anon INSERT is restricted to status='fila' only
  - Processing (status changes) still done by service_role via edge function
*/

-- 1. Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE jobs_traducao;
ALTER PUBLICATION supabase_realtime ADD TABLE noticias;

-- 2. Allow anon to insert jobs (enqueue from frontend)
CREATE POLICY "Anon can enqueue jobs"
  ON jobs_traducao FOR INSERT
  TO anon
  WITH CHECK (status = 'fila' AND url_origem IS NOT NULL AND url_origem <> '');
