DO $mig$
DECLARE src text; nova text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'criar_pedido';
  nova := replace(src,
    'SELECT pv.quantidade - pv.quantidade_reservada INTO v_saldo',
    'SELECT pv.disponivel INTO v_saldo');
  IF nova = src THEN
    RAISE EXCEPTION 'Trecho de saldo não encontrado em criar_pedido.';
  END IF;
  EXECUTE nova;
END $mig$;