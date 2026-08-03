DO $mig$
DECLARE src text; nova text; bloco text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'definir_parametro';

  bloco := '
  IF p_chave = ''alerta_atendimento_minutos''
     AND (p_valor)::int >= COALESCE((SELECT (valor)::int FROM public.parametros_operacionais
                                      WHERE chave = ''atendimento_atrasado_minutos''), 999999) THEN
    RAISE EXCEPTION ''O alerta deve ocorrer antes do atraso de atendimento.'' USING ERRCODE = ''22023'';
  END IF;
  IF p_chave = ''atendimento_atrasado_minutos''
     AND (p_valor)::int <= COALESCE((SELECT (valor)::int FROM public.parametros_operacionais
                                      WHERE chave = ''alerta_atendimento_minutos''), 0) THEN
    RAISE EXCEPTION ''O atraso deve ocorrer depois do alerta de atendimento.'' USING ERRCODE = ''22023'';
  END IF;

  SELECT valor INTO v_anterior FROM public.parametros_operacionais WHERE chave = p_chave;';

  nova := replace(src,
    '
  SELECT valor INTO v_anterior FROM public.parametros_operacionais WHERE chave = p_chave;',
    bloco);
  IF nova = src THEN
    RAISE EXCEPTION 'Âncora não encontrada em definir_parametro.';
  END IF;
  EXECUTE nova;
END $mig$;