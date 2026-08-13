CREATE OR REPLACE FUNCTION public.definir_parametro(p_chave text, p_valor jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min int; v_max int; v_anterior jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master altera parâmetros.' USING ERRCODE = '42501';
  END IF;

  SELECT CASE p_chave
    WHEN 'reserva_peca_unica_minutos' THEN 5
    WHEN 'alerta_atendimento_minutos' THEN 1
    WHEN 'atendimento_atrasado_minutos' THEN 2
    WHEN 'confirmacao_cliente_minutos' THEN 5
    WHEN 'checkout_cooldown_segundos' THEN 10
    WHEN 'checkout_max_pedidos_abertos' THEN 1
    WHEN 'checkout_max_reservas_ativas' THEN 1
    WHEN 'checkout_max_pedidos_hora' THEN 1
  END,
  CASE p_chave
    WHEN 'reserva_peca_unica_minutos' THEN 120
    WHEN 'alerta_atendimento_minutos' THEN 60
    WHEN 'atendimento_atrasado_minutos' THEN 240
    WHEN 'confirmacao_cliente_minutos' THEN 1440
    WHEN 'checkout_cooldown_segundos' THEN 600
    WHEN 'checkout_max_pedidos_abertos' THEN 10
    WHEN 'checkout_max_reservas_ativas' THEN 20
    WHEN 'checkout_max_pedidos_hora' THEN 30
  END INTO v_min, v_max;

  IF v_min IS NULL THEN
    RAISE EXCEPTION 'Parâmetro desconhecido: %', p_chave USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_valor) <> 'number' OR (p_valor)::int < v_min OR (p_valor)::int > v_max THEN
    RAISE EXCEPTION 'Valor de % deve ficar entre % e %.', p_chave, v_min, v_max USING ERRCODE = '22023';
  END IF;

  IF p_chave = 'alerta_atendimento_minutos'
     AND (p_valor)::int >= COALESCE((SELECT (valor)::int FROM public.parametros_operacionais
                                      WHERE chave = 'atendimento_atrasado_minutos'), 999999) THEN
    RAISE EXCEPTION 'O alerta deve ocorrer antes do atraso de atendimento.' USING ERRCODE = '22023';
  END IF;
  IF p_chave = 'atendimento_atrasado_minutos'
     AND (p_valor)::int <= COALESCE((SELECT (valor)::int FROM public.parametros_operacionais
                                      WHERE chave = 'alerta_atendimento_minutos'), 0) THEN
    RAISE EXCEPTION 'O atraso deve ocorrer depois do alerta de atendimento.' USING ERRCODE = '22023';
  END IF;

  SELECT valor INTO v_anterior FROM public.parametros_operacionais WHERE chave = p_chave;

  INSERT INTO public.parametros_operacionais (chave, valor, atualizado_em, atualizado_por)
  VALUES (p_chave, p_valor, now(), auth.uid())
  ON CONFLICT (chave) DO UPDATE
    SET valor = EXCLUDED.valor, atualizado_em = now(), atualizado_por = auth.uid();

  PERFORM public.emitir_notificacao(
    'parametro.alterado', 'Parâmetro operacional alterado',
    format('%s: %s → %s', p_chave, COALESCE(v_anterior::text,'—'), p_valor::text),
    'parametro.alterado:' || p_chave || ':' || extract(epoch from now())::bigint::text,
    'info', 'parametro', NULL,
    jsonb_build_object('chave', p_chave, 'de', v_anterior, 'para', p_valor));
END;
$$;