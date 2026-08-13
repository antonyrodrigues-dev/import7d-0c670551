CREATE OR REPLACE FUNCTION public.avaliar_publicacao(p_produto_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.produtos;
  v_missing text[] := '{}';
  v_block text[] := '{}';
  v_tam_ok int;
  v_tam_total int;
  v_disp int;
  v_sem_composicao int;
BEGIN
  SELECT * INTO p FROM public.produtos WHERE id = p_produto_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('canPublish', false, 'missingFields', jsonb_build_array('produto'),
                              'blockingReasons', jsonb_build_array('Produto inexistente'));
  END IF;

  SELECT count(*) FILTER (WHERE origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')),
         count(*)
    INTO v_tam_ok, v_tam_total
    FROM public.produto_variacoes WHERE produto_id = p.id;

  IF p.modelo_estoque = 'kit' THEN
    SELECT COALESCE(sum(public.kit_disponivel(p.id, pv.tamanho)), 0),
           count(*) FILTER (
             WHERE NOT EXISTS (
               SELECT 1 FROM public.produto_kit_itens ki
                WHERE ki.kit_id = p.id AND ki.kit_tamanho = pv.tamanho))
      INTO v_disp, v_sem_composicao
      FROM public.produto_variacoes pv WHERE pv.produto_id = p.id;

    IF v_sem_composicao > 0 THEN
      v_missing := v_missing || 'composicao'::text;
      v_block := v_block || 'Kit sem composição cadastrada'::text;
    END IF;
  ELSE
    SELECT COALESCE(sum(GREATEST(disponivel,0)), 0) INTO v_disp
      FROM public.produto_variacoes WHERE produto_id = p.id;
  END IF;

  IF p.arquivado_em IS NOT NULL THEN
    v_block := v_block || 'Produto arquivado'::text;
  END IF;
  IF p.preco_status <> 'confirmado' OR COALESCE(p.preco,0) <= 0 THEN
    v_missing := v_missing || 'preco'::text;
    v_block := v_block || 'Preço pendente de confirmação'::text;
  END IF;
  IF v_tam_total = 0 THEN
    v_missing := v_missing || 'tamanho'::text;
    v_block := v_block || 'Nenhum tamanho cadastrado'::text;
  ELSIF v_tam_ok = 0 THEN
    v_missing := v_missing || 'tamanho'::text;
    v_block := v_block || 'Tamanho não confirmado fisicamente'::text;
  END IF;
  IF NOT p.quantidade_conferida THEN
    v_missing := v_missing || 'quantidade'::text;
    v_block := v_block || 'Quantidade não conferida'::text;
  END IF;
  IF jsonb_array_length(COALESCE(p.imagens,'[]'::jsonb)) = 0 THEN
    v_missing := v_missing || 'foto'::text;
    v_block := v_block || 'Sem foto principal'::text;
  END IF;
  IF v_disp <= 0 AND v_tam_total > 0 THEN
    v_block := v_block || (CASE WHEN p.modelo_estoque = 'kit'
      THEN 'Sem saldo: alguma peça do kit está indisponível'
      ELSE 'Sem saldo disponível (vendido, reservado ou em quarentena)' END)::text;
  END IF;
  IF p.status_publicacao <> 'publicado' THEN
    v_block := v_block || ('Status de publicação: ' || p.status_publicacao)::text;
  END IF;
  IF NOT p.ativo THEN
    v_block := v_block || 'Produto inativo'::text;
  END IF;

  RETURN jsonb_build_object(
    'canPublish', (v_missing = '{}' AND p.arquivado_em IS NULL AND v_disp > 0),
    'missingFields', to_jsonb(v_missing),
    'blockingReasons', to_jsonb(v_block)
  );
END $function$;