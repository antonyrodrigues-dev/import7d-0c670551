-- ============ 1. LEDGER FINANCEIRO (append-only) ============
CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  numero_pedido text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita','estorno')),
  origem text NOT NULL CHECK (origem IN ('pagamento','devolucao')),
  referencia_id uuid,
  valor numeric(12,2) NOT NULL,
  metodo text,
  competencia date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  por_usuario uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_sinal_valido CHECK (
    (tipo = 'receita' AND valor > 0) OR (tipo = 'estorno' AND valor < 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_lancamentos_dedupe
  ON public.financeiro_lancamentos (pedido_id, tipo, origem, COALESCE(referencia_id, pedido_id));
CREATE INDEX IF NOT EXISTS financeiro_lancamentos_competencia_idx
  ON public.financeiro_lancamentos (competencia);
CREATE INDEX IF NOT EXISTS financeiro_lancamentos_pedido_idx
  ON public.financeiro_lancamentos (pedido_id);

GRANT SELECT ON public.financeiro_lancamentos TO authenticated;
GRANT ALL ON public.financeiro_lancamentos TO service_role;

ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financeiro_admin_select" ON public.financeiro_lancamentos;
CREATE POLICY "financeiro_admin_select" ON public.financeiro_lancamentos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.financeiro_lancamentos_imutavel()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Lançamentos financeiros são imutáveis.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS financeiro_lancamentos_imutavel_trg ON public.financeiro_lancamentos;
CREATE TRIGGER financeiro_lancamentos_imutavel_trg
  BEFORE UPDATE OR DELETE ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_lancamentos_imutavel();

-- Helper interno (usado apenas pelas RPCs SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.lancar_financeiro(
  p_pedido public.pedidos,
  p_tipo text,
  p_origem text,
  p_valor numeric,
  p_referencia uuid,
  p_detalhe jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(p_valor,0) = 0 THEN RETURN; END IF;
  INSERT INTO public.financeiro_lancamentos
    (pedido_id, numero_pedido, tipo, origem, referencia_id, valor, metodo, detalhe, por_usuario)
  VALUES (
    p_pedido.id, p_pedido.numero_pedido, p_tipo, p_origem, p_referencia,
    CASE WHEN p_tipo = 'estorno' THEN -abs(p_valor) ELSE abs(p_valor) END,
    NULLIF(p_pedido.itens->'pagamento'->>'metodo',''),
    COALESCE(p_detalhe,'{}'::jsonb), auth.uid()
  )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.lancar_financeiro(public.pedidos, text, text, numeric, uuid, jsonb) FROM public, anon, authenticated;

-- ============ 2. MÁQUINA CANÔNICA DE PAGAMENTO ============
CREATE TABLE IF NOT EXISTS public.pagamento_transicoes (
  de text NOT NULL,
  para text NOT NULL,
  PRIMARY KEY (de, para)
);
GRANT SELECT ON public.pagamento_transicoes TO authenticated;
GRANT ALL ON public.pagamento_transicoes TO service_role;
ALTER TABLE public.pagamento_transicoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pagamento_transicoes_leitura" ON public.pagamento_transicoes;
CREATE POLICY "pagamento_transicoes_leitura" ON public.pagamento_transicoes
  FOR SELECT TO authenticated USING (true);

DELETE FROM public.pagamento_transicoes;
INSERT INTO public.pagamento_transicoes (de, para) VALUES
  ('pendente','aguardando_comprovante'),
  ('pendente','em_analise'),
  ('pendente','confirmado'),
  ('pendente','recusado'),
  ('aguardando_comprovante','em_analise'),
  ('aguardando_comprovante','confirmado'),
  ('aguardando_comprovante','recusado'),
  ('aguardando_comprovante','pendente'),
  ('em_analise','confirmado'),
  ('em_analise','recusado'),
  ('em_analise','aguardando_comprovante'),
  ('recusado','aguardando_comprovante'),
  ('recusado','em_analise'),
  ('recusado','pendente'),
  ('confirmado','estornado');

-- ============ 3. registrar_pagamento canônico + ledger ============
CREATE OR REPLACE FUNCTION public.registrar_pagamento(
  p_pedido_id uuid, p_estado text, p_comprovante_url text DEFAULT NULL, p_observacao text DEFAULT NULL
) RETURNS public.pedidos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_de text;
  v_liquido numeric;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'atendente')) THEN
    RAISE EXCEPTION 'Sem permissão para registrar pagamento.' USING ERRCODE = '42501';
  END IF;
  v_admin := public.has_role(v_uid,'admin');
  IF p_estado NOT IN ('pendente','aguardando_comprovante','em_analise','confirmado','recusado','estornado') THEN
    RAISE EXCEPTION 'Estado de pagamento inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_estado IN ('confirmado','estornado') AND NOT v_admin THEN
    RAISE EXCEPTION 'Somente o Admin Master confirma ou estorna pagamento.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_admin AND v_pedido.responsavel_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Este pedido pertence a outro atendente.' USING ERRCODE = '42501';
  END IF;

  IF v_pedido.pagamento_estado = p_estado THEN
    RETURN v_pedido; -- idempotente
  END IF;

  v_de := v_pedido.pagamento_estado;
  IF NOT EXISTS (SELECT 1 FROM public.pagamento_transicoes t WHERE t.de = v_de AND t.para = p_estado) THEN
    RAISE EXCEPTION 'Transição de pagamento não permitida: % -> %.', v_de, p_estado USING ERRCODE = '23514';
  END IF;

  IF p_estado = 'confirmado' AND v_pedido.status IN ('cancelado','devolvido') THEN
    RAISE EXCEPTION 'Pedido % não aceita confirmação de pagamento.', v_pedido.status USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET pagamento_estado = p_estado, atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_pagamentos
    (pedido_id, estado, valor, comprovante_url, observacao, por_usuario)
  VALUES (v_pedido.id, p_estado, v_pedido.valor_total, p_comprovante_url, p_observacao, v_uid);

  IF p_estado = 'confirmado' THEN
    PERFORM public.lancar_financeiro(v_pedido, 'receita', 'pagamento', v_pedido.valor_total, v_pedido.id,
      jsonb_build_object('observacao', p_observacao));
  ELSIF p_estado = 'estornado' THEN
    SELECT COALESCE(SUM(valor),0) INTO v_liquido
      FROM public.financeiro_lancamentos WHERE pedido_id = v_pedido.id;
    IF v_liquido > 0 THEN
      PERFORM public.lancar_financeiro(v_pedido, 'estorno', 'pagamento', v_liquido, v_pedido.id,
        jsonb_build_object('motivo', COALESCE(p_observacao,'Estorno de pagamento')));
    END IF;
  END IF;

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pagamento.estado', 'equipe', v_uid,
          jsonb_build_object('de', v_de, 'estado', p_estado));

  RETURN v_pedido;
END;
$$;

-- ============ 4. registrar_devolucao: ledger + estado parcial ============
CREATE OR REPLACE FUNCTION public.registrar_devolucao(
  p_pedido_id uuid, p_itens jsonb, p_motivo text, p_valor_estornado numeric DEFAULT 0,
  p_observacoes text DEFAULT NULL, p_evidencias jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_dev_id uuid;
  v_item jsonb;
  v_slug text; v_size text; v_qty int; v_cond text;
  v_produto_id uuid; v_current int;
  v_vendido int; v_ja_devolvido int;
  v_total_devolvido numeric;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master aprova devoluções.' USING ERRCODE = '42501';
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
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
  VALUES (p_pedido_id, btrim(p_motivo), COALESCE(p_valor_estornado,0), p_observacoes,
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
    IF v_cond NOT IN ('vendavel','usada','avariada','defeituosa','divergencia','outra') THEN
      RAISE EXCEPTION 'Condição da peça inválida.' USING ERRCODE = '22023';
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
              v_current, v_current + v_qty, btrim(p_motivo));
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
              v_current, v_current + v_qty, format('%s (%s)', btrim(p_motivo), v_cond));
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

  v_total_devolvido := v_pedido.valor_devolvido + COALESCE(p_valor_estornado,0);

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET status = 'devolvido',
         valor_devolvido = v_total_devolvido,
         pagamento_estado = CASE
             WHEN pedidos.pagamento_estado = 'confirmado' AND v_total_devolvido >= pedidos.valor_total
               THEN 'estornado' ELSE pedidos.pagamento_estado END,
         atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  IF COALESCE(p_valor_estornado,0) > 0 THEN
    PERFORM public.lancar_financeiro(v_pedido, 'estorno', 'devolucao', p_valor_estornado, v_dev_id,
      jsonb_build_object('motivo', btrim(p_motivo)));
  END IF;

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (p_pedido_id, v_pedido.numero_pedido, 'pedido.devolvido', 'equipe', v_uid,
          jsonb_build_object('devolucao_id', v_dev_id, 'valor_estornado', COALESCE(p_valor_estornado,0)));

  RETURN v_dev_id;
END;
$$;

-- ============ 5. CARGA HISTÓRICA DO LEDGER ============
INSERT INTO public.financeiro_lancamentos
  (pedido_id, numero_pedido, tipo, origem, referencia_id, valor, metodo, competencia, detalhe, criado_em)
SELECT p.id, p.numero_pedido, 'receita', 'pagamento', p.id, p.valor_total,
       NULLIF(p.itens->'pagamento'->>'metodo',''),
       (p.atualizado_em AT TIME ZONE 'America/Sao_Paulo')::date,
       jsonb_build_object('backfill', true), p.atualizado_em
  FROM public.pedidos p
 WHERE p.pagamento_estado IN ('confirmado','estornado')
   AND p.valor_total > 0
ON CONFLICT DO NOTHING;

INSERT INTO public.financeiro_lancamentos
  (pedido_id, numero_pedido, tipo, origem, referencia_id, valor, metodo, competencia, detalhe, criado_em)
SELECT d.pedido_id, p.numero_pedido, 'estorno', 'devolucao', d.id, -d.valor_estornado,
       NULLIF(p.itens->'pagamento'->>'metodo',''),
       (d.criado_em AT TIME ZONE 'America/Sao_Paulo')::date,
       jsonb_build_object('backfill', true, 'motivo', d.motivo), d.criado_em
  FROM public.pedido_devolucoes d
  JOIN public.pedidos p ON p.id = d.pedido_id
 WHERE d.valor_estornado > 0
ON CONFLICT DO NOTHING;

-- ============ 6. MÉTRICAS DERIVADAS DO LEDGER ============
CREATE OR REPLACE FUNCTION public.metricas_financeiras(p_periodo text DEFAULT '30d')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
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

  WITH ledger AS (
    SELECT l.*, p.atendente_nome, p.itens
      FROM public.financeiro_lancamentos l
      JOIN public.pedidos p ON p.id = l.pedido_id
  ),
  periodo AS (SELECT * FROM ledger WHERE competencia >= v_desde),
  por_pedido AS (
    SELECT pedido_id, max(numero_pedido) AS numero_pedido,
           max(atendente_nome) AS atendente_nome, max(itens) AS itens,
           sum(valor) AS liquido
      FROM periodo GROUP BY pedido_id
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
           (i->>'price')::numeric * (i->>'quantity')::int AS receita
      FROM por_pedido, jsonb_array_elements(itens->'produtos') i
  ),
  top_prod AS (
    SELECT name, sum(qtd) AS unidades, sum(receita) AS receita
      FROM itens GROUP BY name ORDER BY sum(receita) DESC LIMIT 5
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
    'receitaDia', COALESCE((SELECT sum(valor) FROM ledger WHERE competencia = v_hoje),0),
    'receitaMes', COALESCE((SELECT sum(valor) FROM ledger
        WHERE date_trunc('month', competencia) = date_trunc('month', v_hoje)),0),
    'receitaAno', COALESCE((SELECT sum(valor) FROM ledger
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
        'name', name, 'unidades', unidades, 'receita', receita)) FROM top_prod), '[]'::jsonb),
    'topAtendentes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'nome', nome, 'receita', receita, 'pedidos', pedidos)) FROM top_atend), '[]'::jsonb),
    'pagamentos', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'metodo', metodo, 'receita', receita, 'pedidos', pedidos)) FROM pagto), '[]'::jsonb)
  ) INTO v_res;

  RETURN v_res;
END;
$$;
