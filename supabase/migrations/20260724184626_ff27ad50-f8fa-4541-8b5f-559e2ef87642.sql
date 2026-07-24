CREATE OR REPLACE FUNCTION public.cancelar_pedido_checkout(
  p_pedido_id uuid,
  p_idempotency_key text
)
RETURNS TABLE(id uuid, numero_pedido text, status text, valor_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_item jsonb;
  v_slug text;
  v_size text;
  v_qty int;
  v_produto_id uuid;
BEGIN
  IF p_pedido_id IS NULL OR COALESCE(p_idempotency_key, '') = '' THEN
    RAISE EXCEPTION 'Pedido/chave inválidos para cancelamento.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pedido
    FROM public.pedidos
   WHERE pedidos.id = p_pedido_id
     AND pedidos.idempotency_key = p_idempotency_key
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada para cancelamento.' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotência: cancelar novamente não deve duplicar histórico nem estoque.
  IF v_pedido.status = 'cancelado' THEN
    RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.status, v_pedido.valor_total;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pedido_transicoes
     WHERE de = v_pedido.status AND para = 'cancelado'
  ) THEN
    RAISE EXCEPTION 'Solicitação não pode mais ser cancelada pelo checkout.' USING ERRCODE = '23514';
  END IF;

  -- Se a equipe já tiver aplicado consumo/reserva de estoque, estorna na mesma transação.
  IF v_pedido.consumo_aplicado THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_pedido.itens->'produtos') LOOP
      v_slug := v_item->>'slug';
      v_size := v_item->>'size';
      v_qty  := COALESCE((v_item->>'quantity')::int, 0);
      IF v_slug IS NULL OR v_size IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

      SELECT produtos.id INTO v_produto_id FROM public.produtos WHERE produtos.slug = v_slug;
      IF v_produto_id IS NULL THEN
        RAISE EXCEPTION 'Produto do pedido não localizado (%).', v_slug;
      END IF;

      UPDATE public.produto_variacoes
         SET quantidade = quantidade + v_qty
       WHERE produto_id = v_produto_id AND tamanho = v_size;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variação % / % ausente.', v_slug, v_size;
      END IF;

      INSERT INTO public.produto_movimentacoes
        (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id)
      VALUES
        (v_produto_id, v_size, 'entrada', v_qty, NULL,
         format('Cancelamento do checkout %s', v_pedido.numero_pedido), v_pedido.id);
    END LOOP;
  END IF;

  UPDATE public.pedidos
     SET status = 'cancelado',
         atualizado_em = now(),
         consumo_aplicado = false
   WHERE pedidos.id = v_pedido.id
   RETURNING * INTO v_pedido;

  RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.status, v_pedido.valor_total;
END
$function$;

REVOKE ALL ON FUNCTION public.cancelar_pedido_checkout(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido_checkout(uuid, text) TO anon, authenticated, service_role;