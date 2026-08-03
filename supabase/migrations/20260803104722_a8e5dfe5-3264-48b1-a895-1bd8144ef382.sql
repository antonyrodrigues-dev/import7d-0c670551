CREATE OR REPLACE FUNCTION public.status_job_reservas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito ao Admin Master.' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'jobname', j.jobname,
    'schedule', j.schedule,
    'command', j.command,
    'active', j.active,
    'ultimas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status', d.status, 'mensagem', d.return_message,
                                          'inicio', d.start_time, 'fim', d.end_time)
                       ORDER BY d.start_time DESC)
        FROM (SELECT * FROM cron.job_run_details rd
               WHERE rd.jobid = j.jobid ORDER BY rd.start_time DESC LIMIT 5) d
    ), '[]'::jsonb))
    INTO v
    FROM cron.job j
   WHERE j.jobname = '7d-expirar-reservas';
  RETURN COALESCE(v, '{}'::jsonb);
END $$;

REVOKE EXECUTE ON FUNCTION public.status_job_reservas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.status_job_reservas() TO authenticated, service_role;