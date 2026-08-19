CREATE OR REPLACE FUNCTION public.sincronizar_variacoes(
  p_produto_id uuid,
  p_variacoes jsonb,
  p_observacao text DEFAULT 'Ajuste via edição de produto'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_tamanho text;
  v_qty integer;
  v_sizes text[] := ARRAY[]::text[];
  v_removida record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas o Administrador Master pode alterar variações de estoque.';
  END IF;

  IF p_produto_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.produtos WHERE id = p_produto_id) THEN
    RAISE EXCEPTION 'Produto inexistente.';
  END IF;

  IF p_variacoes IS NULL OR jsonb_typeof(p_variacoes) <> 'array' OR jsonb_array_length(p_variacoes) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um tamanho.';
  END IF;

  -- Normaliza e valida a lista desejada
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_variacoes) LOOP
    v_tamanho := upper(btrim(coalesce(v_item->>'tamanho', '')));
    v_qty := coalesce((v_item->>'quantidade')::integer, 0);
    IF v_tamanho = '' THEN
      RAISE EXCEPTION 'Tamanho inválido.';
    END IF;
    IF v_qty < 0 THEN
      RAISE EXCEPTION 'Quantidade não pode ser negativa (tamanho %).', v_tamanho;
    END IF;
    IF v_tamanho = ANY (v_sizes) THEN
      RAISE EXCEPTION 'Tamanho duplicado: %.', v_tamanho;
    END IF;
    v_sizes := array_append(v_sizes, v_tamanho);
  END LOOP;

  -- Remove tamanhos ausentes, protegendo reservas ativas
  FOR v_removida IN
    SELECT id, tamanho, quantidade_reservada
    FROM public.produto_variacoes
    WHERE produto_id = p_produto_id AND NOT (tamanho = ANY (v_sizes))
    FOR UPDATE
  LOOP
    IF coalesce(v_removida.quantidade_reservada, 0) > 0 THEN
      RAISE EXCEPTION 'O tamanho % possui reserva ativa e não pode ser removido.', v_removida.tamanho;
    END IF;
    DELETE FROM public.produto_variacoes WHERE id = v_removida.id;
  END LOOP;

  -- Cria/ajusta os tamanhos desejados (ajuste passa pela rotina auditada)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_variacoes) LOOP
    v_tamanho := upper(btrim(v_item->>'tamanho'));
    v_qty := coalesce((v_item->>'quantidade')::integer, 0);

    INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade)
    VALUES (p_produto_id, v_tamanho, 0)
    ON CONFLICT (produto_id, tamanho) DO NOTHING;

    IF (SELECT quantidade FROM public.produto_variacoes
        WHERE produto_id = p_produto_id AND tamanho = v_tamanho) <> v_qty THEN
      PERFORM public.ajustar_estoque(p_produto_id, v_tamanho, 'ajuste', v_qty, p_observacao, NULL);
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_variacoes(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_variacoes(uuid, jsonb, text) TO authenticated, service_role;

ALTER TABLE public.produtos REPLICA IDENTITY FULL;
ALTER TABLE public.produto_variacoes REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.produto_variacoes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;