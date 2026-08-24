CREATE OR REPLACE FUNCTION public.conferir_produto(
  p_produto_id uuid,
  p_preco numeric,
  p_tamanho text,
  p_origem text,
  p_evidencia text,
  p_quantidade integer,
  p_preco_cartao numeric DEFAULT NULL,
  p_parcelamento text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prod public.produtos;
  v_tam text := btrim(COALESCE(p_tamanho,''));
  v_evid text := btrim(COALESCE(p_evidencia,''));
  v_aval jsonb;
  v_novo_status text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master confere peças.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_prod FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto inexistente.' USING ERRCODE = '22023';
  END IF;
  IF v_prod.arquivado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Produto arquivado não pode ser conferido.' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_preco,0) <= 0 THEN
    RAISE EXCEPTION 'Preço oficial deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF v_tam = '' THEN
    RAISE EXCEPTION 'Informe o tamanho conferido.' USING ERRCODE = '22023';
  END IF;
  IF p_origem NOT IN ('confirmado_etiqueta','confirmado_medicao') THEN
    RAISE EXCEPTION 'Origem do tamanho inválida.' USING ERRCODE = '22023';
  END IF;
  IF v_evid = '' THEN
    RAISE EXCEPTION 'Evidência do tamanho é obrigatória.' USING ERRCODE = '22023';
  END IF;
  IF v_prod.modelo_estoque <> 'kit' AND COALESCE(p_quantidade,-1) < 0 THEN
    RAISE EXCEPTION 'Quantidade física inválida.' USING ERRCODE = '22023';
  END IF;

  v_tam := upper(v_tam);

  UPDATE public.produtos
     SET preco = p_preco,
         preco_status = 'confirmado',
         preco_cartao = COALESCE(p_preco_cartao, preco_cartao),
         parcelamento = COALESCE(NULLIF(btrim(COALESCE(p_parcelamento,'')),''), parcelamento),
         quantidade_conferida = true,
         atualizado_em = now()
   WHERE id = p_produto_id;

  INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade)
  VALUES (p_produto_id, v_tam, 0)
  ON CONFLICT (produto_id, tamanho) DO NOTHING;

  UPDATE public.produto_variacoes
     SET origem_tamanho = p_origem,
         origem_tamanho_evidencia = v_evid,
         origem_tamanho_confirmado_em = now(),
         origem_tamanho_confirmado_por = v_uid,
         atualizado_em = now()
   WHERE produto_id = p_produto_id AND tamanho = v_tam;

  IF v_prod.modelo_estoque <> 'kit' THEN
    PERFORM public.ajustar_estoque(
      p_produto_id, v_tam, 'ajuste', p_quantidade,
      'Conferência física da peça', NULL);
  END IF;

  v_aval := public.avaliar_publicacao(p_produto_id);
  v_novo_status := CASE WHEN (v_aval->>'canPublish')::boolean THEN 'publicado'
                        ELSE 'revisao_pendente' END;

  UPDATE public.produtos
     SET status_publicacao = v_novo_status,
         ativo = CASE WHEN v_novo_status = 'publicado' THEN true ELSE ativo END,
         atualizado_em = now()
   WHERE id = p_produto_id;

  RETURN jsonb_build_object(
    'produtoId', p_produto_id,
    'statusPublicacao', v_novo_status,
    'avaliacao', public.avaliar_publicacao(p_produto_id));
END $function$;

REVOKE ALL ON FUNCTION public.conferir_produto(uuid, numeric, text, text, text, integer, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.conferir_produto(uuid, numeric, text, text, text, integer, numeric, text) TO authenticated;