DO $$
DECLARE v_def text; v_sql text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conname = 'produto_movimentacoes_tipo_check'
     AND conrelid = 'public.produto_movimentacoes'::regclass;
  IF v_def IS NOT NULL AND v_def NOT LIKE '%''quarentena''%' THEN
    ALTER TABLE public.produto_movimentacoes DROP CONSTRAINT produto_movimentacoes_tipo_check;
    v_sql := format(
      'ALTER TABLE public.produto_movimentacoes ADD CONSTRAINT produto_movimentacoes_tipo_check %s',
      replace(v_def, 'ARRAY[', 'ARRAY[''quarentena''::text, '));
    EXECUTE v_sql;
  END IF;
END $$;