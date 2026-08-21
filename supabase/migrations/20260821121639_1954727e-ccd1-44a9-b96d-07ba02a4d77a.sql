-- C1.3 — condição física: garante os valores canônicos + legados (idempotente, forward-only)
ALTER TABLE public.pedido_devolucao_itens
  DROP CONSTRAINT IF EXISTS pedido_devolucao_itens_condicao_check;
ALTER TABLE public.pedido_devolucao_itens
  ADD CONSTRAINT pedido_devolucao_itens_condicao_check
  CHECK (condicao IN ('vendavel','usada','avariada','defeituosa','divergencia','outra'));

-- Motivo comercial (separado da condição física). Legados preservados.
ALTER TABLE public.pedido_devolucoes
  DROP CONSTRAINT IF EXISTS pedido_devolucoes_motivo_check;

CREATE OR REPLACE FUNCTION public.devolucao_motivo_valido(p_motivo text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT btrim(COALESCE(p_motivo,'')) <> '';
$$;

-- C1.1 — metricas_financeiras sem agregação inválida de JSONB
CREATE OR REPLACE FUNCTION public.metricas_financeiras(p_periodo text DEFAULT '30d'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_desde date;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_res jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Acesso restrito ao Admin Master.' USING ERRCODE = '42501';
  END IF;

  v_desde := CASE p_periodo
    WHEN '7d'  THEN v_hoje - 7
    WHEN '30d' THEN v_hoje - 30
    WHEN '90d' THEN v_hoje - 90
    WHEN 'ano' THEN date_trunc('year', v_hoje::timestamp)::date
    WHEN 'todos' THEN '-infinity'::date
    ELSE v_hoje - 30
  END;

  WITH periodo AS (
    SELECT l.* FROM public.financeiro_lancamentos l WHERE l.competencia >= v_desde
  ),
  -- 1) agrega o ledger por pedido (somente colunas escalares)
  ledger_por_pedido AS (
    SELECT pedido_id, sum(valor) AS liquido
      FROM periodo GROUP BY pedido_id
  ),
  -- 2) só depois faz JOIN com pedidos: itens (jsonb) nunca é agregado
  por_pedido AS (
    SELECT lp.pedido_id, p.numero_pedido, p.atendente_nome, p.itens, lp.liquido
      FROM ledger_por_pedido lp
      JOIN public.pedidos p ON p.id = lp.pedido_id
  ),
  cancelados AS (
    SELECT count(*) AS n FROM public.pedidos
     WHERE status = 'cancelado'
       AND (atualizado_em AT TIME ZONE 'America/Sao_Paulo')::date >= v_desde
  ),
  serie AS (
    SELECT to_char(competencia,'DD/MM') AS label, competencia AS dia,
           sum(valor) AS receita,
           count(DISTINCT pedido_id) FILTER (WHERE tipo = 'receita') AS pedidos
      FROM periodo GROUP BY 1,2 ORDER BY 2
  ),
  itens AS (
    SELECT i->>'name' AS name, (i->>'quantity')::int AS qtd,
           (i->>'price')::numeric * (i->>'quantity')::int AS bruta
      FROM por_pedido pp, jsonb_array_elements(COALESCE(pp.itens->'produtos','[]'::jsonb)) i
  ),
  top_prod AS (
    SELECT name, sum(qtd) AS unidades, sum(bruta) AS bruta
      FROM itens WHERE name IS NOT NULL GROUP BY name ORDER BY sum(bruta) DESC LIMIT 5
  ),
  top_atend AS (
    SELECT COALESCE(atendente_nome,'Sem responsável') AS nome,
           sum(liquido) AS receita, count(*) AS pedidos
      FROM por_pedido GROUP BY 1 ORDER BY sum(liquido) DESC LIMIT 5
  ),
  pagto AS (
    SELECT COALESCE(metodo,'—') AS metodo,
           sum(valor) AS receita, count(DISTINCT pedido_id) AS pedidos
      FROM periodo GROUP BY 1 ORDER BY sum(valor) DESC
  ),
  totais AS (
    SELECT
      COALESCE((SELECT sum(valor) FROM periodo),0) AS liquido,
      COALESCE((SELECT -sum(valor) FROM periodo WHERE tipo = 'estorno'),0) AS devolvido,
      COALESCE((SELECT count(DISTINCT pedido_id) FROM periodo WHERE tipo = 'receita'),0) AS finalizados
  )
  SELECT jsonb_build_object(
    'periodo', p_periodo,
    'receitaDia', COALESCE((SELECT sum(valor) FROM public.financeiro_lancamentos
        WHERE competencia = v_hoje),0),
    'receitaMes', COALESCE((SELECT sum(valor) FROM public.financeiro_lancamentos
        WHERE date_trunc('month', competencia) = date_trunc('month', v_hoje)),0),
    'receitaAno', COALESCE((SELECT sum(valor) FROM public.financeiro_lancamentos
        WHERE date_trunc('year', competencia) = date_trunc('year', v_hoje)),0),
    'receitaPeriodo', (SELECT liquido FROM totais),
    'pedidosFinalizados', (SELECT finalizados FROM totais),
    'pedidosCancelados', COALESCE((SELECT n FROM cancelados),0),
    'valorDevolvido', (SELECT devolvido FROM totais),
    'ticketMedioPeriodo', (SELECT CASE WHEN finalizados = 0 THEN 0
        ELSE round(liquido / finalizados, 2) END FROM totais),
    'taxaCancelamentoPct', (SELECT CASE
        WHEN finalizados + COALESCE((SELECT n FROM cancelados),0) = 0 THEN 0
        ELSE round(100.0 * COALESCE((SELECT n FROM cancelados),0)
             / (finalizados + COALESCE((SELECT n FROM cancelados),0)), 1) END FROM totais),
    'series', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'label', label, 'receita', receita, 'pedidos', pedidos)) FROM serie), '[]'::jsonb),
    'topProdutos', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'name', name, 'unidades', unidades, 'receitaBruta', bruta)) FROM top_prod), '[]'::jsonb),
    'topAtendentes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'nome', nome, 'receita', receita, 'pedidos', pedidos)) FROM top_atend), '[]'::jsonb),
    'pagamentos', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'metodo', metodo, 'receita', receita, 'pedidos', pedidos)) FROM pagto), '[]'::jsonb)
  ) INTO v_res;

  RETURN v_res;
END;
$function$;

REVOKE ALL ON FUNCTION public.metricas_financeiras(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.metricas_financeiras(text) TO authenticated;

-- C1.3 — registrar_devolucao: destino de estoque decidido pela CONDIÇÃO física
CREATE OR REPLACE FUNCTION public.registrar_devolucao(p_pedido_id uuid, p_itens jsonb, p_motivo text, p_valor_estornado numeric DEFAULT 0, p_observacoes text DEFAULT NULL::text, p_evidencias jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_dev_id uuid;
  v_item jsonb;
  v_slug text; v_size text; v_qty int; v_cond text;
  v_produto_id uuid; v_current int;
  v_vendido int; v_ja_devolvido int;
  v_qtd_vendida int; v_qtd_devolvida int;
  v_integral boolean;
  v_motivo text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master aprova devoluções.' USING ERRCODE = '42501';
  END IF;
  v_motivo := btrim(COALESCE(p_motivo,''));
  IF NOT public.devolucao_motivo_valido(v_motivo) THEN
    RAISE EXCEPTION 'Motivo da devolução é obrigatório.' USING ERRCODE = '22023';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Devolução sem itens.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.status NOT IN ('finalizado','devolvido') THEN
    RAISE EXCEPTION 'Somente pedidos finalizados podem ser devolvidos.' USING ERRCODE = '23514';
  END IF;
  IF COALESCE(p_valor_estornado,0) < 0
     OR (v_pedido.valor_devolvido + COALESCE(p_valor_estornado,0)) > v_pedido.valor_total THEN
    RAISE EXCEPTION 'Valor estornado excede o total do pedido.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pedido_devolucoes
    (pedido_id, motivo, valor_estornado, observacoes, evidencias, aprovado_por)
  VALUES (p_pedido_id, v_motivo, COALESCE(p_valor_estornado,0), p_observacoes,
          COALESCE(p_evidencias,'[]'::jsonb), v_uid)
  RETURNING id INTO v_dev_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_slug := btrim(COALESCE(v_item->>'slug',''));
    v_size := btrim(COALESCE(v_item->>'size',''));
    v_qty  := COALESCE((v_item->>'quantity')::int, 0);
    v_cond := COALESCE(v_item->>'condicao','');
    IF v_slug = '' OR v_size = '' OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item de devolução inválido.' USING ERRCODE = '22023';
    END IF;
    -- canônicos + legados (registros antigos)
    IF v_cond NOT IN ('vendavel','usada','avariada','defeituosa','divergencia','outra') THEN
      RAISE EXCEPTION 'Condição da peça inválida: %', v_cond USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(SUM((p->>'quantity')::int), 0) INTO v_vendido
      FROM jsonb_array_elements(v_pedido.itens->'produtos') p
     WHERE p->>'slug' = v_slug AND p->>'size' = v_size;

    SELECT COALESCE(SUM(di.quantidade), 0) INTO v_ja_devolvido
      FROM public.pedido_devolucao_itens di
      JOIN public.pedido_devolucoes d ON d.id = di.devolucao_id
     WHERE d.pedido_id = p_pedido_id AND di.slug = v_slug AND di.tamanho = v_size
       AND di.devolucao_id <> v_dev_id;

    IF (v_ja_devolvido + v_qty) > v_vendido THEN
      RAISE EXCEPTION 'Quantidade devolvida maior que a vendida (% tam %).', v_slug, v_size
        USING ERRCODE = '22023';
    END IF;

    SELECT produtos.id INTO v_produto_id FROM public.produtos WHERE produtos.slug = v_slug;
    IF v_produto_id IS NULL THEN
      RAISE EXCEPTION 'Produto da devolução não localizado (%).', v_slug USING ERRCODE = 'P0002';
    END IF;

    SELECT quantidade INTO v_current
      FROM public.produto_variacoes
     WHERE produto_id = v_produto_id AND tamanho = v_size
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variação % / % ausente.', v_slug, v_size USING ERRCODE = 'P0002';
    END IF;

    IF v_cond = 'vendavel' THEN
      UPDATE public.produto_variacoes
         SET quantidade = quantidade + v_qty, atualizado_em = now()
       WHERE produto_id = v_produto_id AND tamanho = v_size;
      INSERT INTO public.produto_movimentacoes
        (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id,
         saldo_anterior, saldo_posterior, motivo)
      VALUES (v_produto_id, v_size, 'devolucao', v_qty, v_uid,
              format('Devolução do pedido %s', v_pedido.numero_pedido), v_pedido.id,
              v_current, v_current + v_qty, v_motivo);
    ELSE
      UPDATE public.produto_variacoes
         SET quantidade = quantidade + v_qty,
             quantidade_quarentena = quantidade_quarentena + v_qty,
             atualizado_em = now()
       WHERE produto_id = v_produto_id AND tamanho = v_size;
      INSERT INTO public.produto_movimentacoes
        (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id,
         saldo_anterior, saldo_posterior, motivo)
      VALUES (v_produto_id, v_size, 'quarentena', v_qty, v_uid,
              format('Quarentena — devolução do pedido %s', v_pedido.numero_pedido), v_pedido.id,
              v_current, v_current + v_qty, format('%s (%s)', v_motivo, v_cond));
      PERFORM public.emitir_notificacao(
        'estoque.quarentena', 'Peça enviada à quarentena',
        format('%s (%s) — %s un. do pedido %s', v_slug, v_size, v_qty, v_pedido.numero_pedido),
        'estoque.quarentena:' || v_dev_id::text || ':' || v_slug || ':' || v_size,
        'alerta', 'produto', v_produto_id, jsonb_build_object('condicao', v_cond));
    END IF;

    INSERT INTO public.pedido_devolucao_itens
      (devolucao_id, produto_id, slug, tamanho, quantidade, condicao, retornou_estoque)
    VALUES (v_dev_id, v_produto_id, v_slug, v_size, v_qty, v_cond, v_cond = 'vendavel');
  END LOOP;

  UPDATE public.pedidos
     SET valor_devolvido = valor_devolvido + COALESCE(p_valor_estornado,0),
         atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;

  IF COALESCE(p_valor_estornado,0) > 0 THEN
    PERFORM public.lancar_financeiro(v_pedido, 'estorno', 'devolucao',
      -COALESCE(p_valor_estornado,0), v_dev_id,
      jsonb_build_object('motivo', v_motivo));
  END IF;

  SELECT COALESCE(SUM((p->>'quantity')::int),0) INTO v_qtd_vendida
    FROM jsonb_array_elements(v_pedido.itens->'produtos') p;
  SELECT COALESCE(SUM(di.quantidade),0) INTO v_qtd_devolvida
    FROM public.pedido_devolucao_itens di
    JOIN public.pedido_devolucoes d ON d.id = di.devolucao_id
   WHERE d.pedido_id = p_pedido_id;
  v_integral := v_qtd_devolvida >= v_qtd_vendida;

  IF v_integral AND v_pedido.status <> 'devolvido' THEN
    PERFORM set_config('app.rpc_ctx','on', true);
    UPDATE public.pedidos SET status = 'devolvido', atualizado_em = now()
     WHERE pedidos.id = p_pedido_id;
    PERFORM set_config('app.rpc_ctx','off', true);
  END IF;

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (p_pedido_id, v_pedido.numero_pedido, 'pedido.devolucao', 'equipe', v_uid,
          jsonb_build_object('motivo', v_motivo, 'valor', COALESCE(p_valor_estornado,0),
                             'integral', v_integral, 'devolucao_id', v_dev_id));

  RETURN v_dev_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_devolucao(uuid, jsonb, text, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_devolucao(uuid, jsonb, text, numeric, text, jsonb) TO authenticated;