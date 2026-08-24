-- ───────────────── Telefone canônico ─────────────────
CREATE OR REPLACE FUNCTION public.normalizar_telefone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    ELSE (
      SELECT CASE
        WHEN length(d) > 11 AND left(d, 2) = '55' THEN right(d, length(d) - 2)
        ELSE d
      END
      FROM (SELECT regexp_replace(p, '\D', '', 'g') AS d) s
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.equipe_autorizada()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'atendente')
$$;

-- ───────────────── Clientes server-side ─────────────────
CREATE OR REPLACE FUNCTION public.listar_clientes(
  p_busca text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  telefone text,
  nome text,
  cidade text,
  pedidos integer,
  ultima_compra timestamptz,
  valor_gasto numeric,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g');
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
BEGIN
  IF NOT public.equipe_autorizada() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe.';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      p.id,
      p.criado_em,
      public.normalizar_telefone(p.itens->'cliente'->>'telefone') AS tel,
      coalesce(nullif(p.itens->'cliente'->>'nome', ''), '—') AS nome,
      coalesce(
        nullif(p.itens->'cliente'->>'cidade', ''),
        nullif(p.itens->'entrega'->'endereco'->>'cidade', ''),
        '—'
      ) AS cidade
    FROM public.pedidos p
  ),
  led AS (
    SELECT b.tel, coalesce(sum(f.valor), 0) AS liquido
    FROM base b
    JOIN public.financeiro_lancamentos f ON f.pedido_id = b.id
    GROUP BY b.tel
  ),
  agg AS (
    SELECT
      b.tel,
      (array_agg(b.nome ORDER BY b.criado_em DESC))[1] AS nome,
      (array_agg(b.cidade ORDER BY b.criado_em DESC))[1] AS cidade,
      count(*)::integer AS pedidos,
      max(b.criado_em) AS ultima_compra,
      coalesce(max(l.liquido), 0) AS valor_gasto
    FROM base b
    LEFT JOIN led l ON l.tel IS NOT DISTINCT FROM b.tel
    WHERE b.tel IS NOT NULL AND b.tel <> ''
    GROUP BY b.tel
  ),
  filtrado AS (
    SELECT * FROM agg a
    WHERE v_busca IS NULL
       OR a.nome ILIKE '%' || v_busca || '%'
       OR a.cidade ILIKE '%' || v_busca || '%'
       OR (v_digits <> '' AND a.tel LIKE '%' || v_digits || '%')
  )
  SELECT
    f.tel,
    f.nome,
    f.cidade,
    f.pedidos,
    f.ultima_compra,
    round(greatest(f.valor_gasto, 0), 2),
    count(*) OVER ()
  FROM filtrado f
  ORDER BY f.valor_gasto DESC, f.ultima_compra DESC NULLS LAST, f.tel
  OFFSET greatest(coalesce(p_offset, 0), 0)
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 100);
END;
$$;

-- ───────────────── Dashboard server-side (ledger é autoridade) ─────────────────
CREATE OR REPLACE FUNCTION public.metricas_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean := public.has_role(auth.uid(), 'admin');
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_atraso integer := public.parametro_int('atendimento_atrasado_minutos', 60);
  v_out jsonb;
  v_fin jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.equipe_autorizada() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe.';
  END IF;

  SELECT jsonb_build_object(
    'pedidosHoje', count(*) FILTER (
      WHERE (p.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = v_hoje
    ),
    'pedidosEmAberto', count(*) FILTER (
      WHERE p.status NOT IN ('finalizado', 'cancelado', 'devolvido')
    ),
    'atendimentosAguardando', count(*) FILTER (
      WHERE p.status IN ('novo', 'whatsapp_declarado', 'aguardando_atendimento')
    ),
    'atendimentosAtrasados', count(*) FILTER (
      WHERE p.status IN ('novo', 'whatsapp_declarado', 'aguardando_atendimento')
        AND p.criado_em < now() - make_interval(mins => v_atraso)
    ),
    'pedidosComPendencia', count(*) FILTER (
      WHERE (p.pendencia_preco OR p.pendencia_tamanho)
        AND p.status NOT IN ('finalizado', 'cancelado', 'devolvido')
    ),
    'pedidosFinalizados', count(*) FILTER (WHERE p.status = 'finalizado')
  )
  INTO v_out
  FROM public.pedidos p;

  v_out := v_out
    || jsonb_build_object(
      'clientes', (
        SELECT count(DISTINCT public.normalizar_telefone(p.itens->'cliente'->>'telefone'))
        FROM public.pedidos p
        WHERE public.normalizar_telefone(p.itens->'cliente'->>'telefone') IS NOT NULL
      ),
      'produtos', (
        SELECT count(*) FROM public.produtos WHERE arquivado_em IS NULL
      ),
      'estoqueBaixo', (
        SELECT count(*) FROM (
          SELECT v.produto_id
          FROM public.produto_variacoes v
          JOIN public.produtos pr ON pr.id = v.produto_id AND pr.arquivado_em IS NULL
          GROUP BY v.produto_id
          HAVING coalesce(sum(v.disponivel), 0) <= 2
        ) s
      ),
      'pendenciasEstoque', (
        SELECT count(*) FROM public.produtos
        WHERE arquivado_em IS NULL AND quantidade_conferida = false
      ),
      'financeiroVisivel', v_admin,
      'atualizadoEm', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
    );

  IF v_admin THEN
    SELECT jsonb_build_object(
      'receitaLiquidaDia', coalesce(round(sum(f.valor) FILTER (WHERE f.competencia = v_hoje), 2), 0),
      'receitaLiquidaMes', coalesce(round(sum(f.valor) FILTER (
        WHERE date_trunc('month', f.competencia) = date_trunc('month', v_hoje)
      ), 2), 0),
      'vendasMes', coalesce(count(DISTINCT f.pedido_id) FILTER (
        WHERE f.tipo = 'receita'
          AND date_trunc('month', f.competencia) = date_trunc('month', v_hoje)
      ), 0),
      'ticketMedioMes', CASE
        WHEN count(DISTINCT f.pedido_id) FILTER (
          WHERE f.tipo = 'receita'
            AND date_trunc('month', f.competencia) = date_trunc('month', v_hoje)
        ) = 0 THEN 0
        ELSE round(
          coalesce(sum(f.valor) FILTER (
            WHERE date_trunc('month', f.competencia) = date_trunc('month', v_hoje)
          ), 0)
          / count(DISTINCT f.pedido_id) FILTER (
            WHERE f.tipo = 'receita'
              AND date_trunc('month', f.competencia) = date_trunc('month', v_hoje)
          ), 2)
      END
    )
    INTO v_fin
    FROM public.financeiro_lancamentos f;
  END IF;

  RETURN v_out || v_fin;
END;
$$;

-- ───────────────── Pedidos paginados server-side ─────────────────
CREATE OR REPLACE FUNCTION public.listar_pedidos(
  p_statuses text[] DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 25
)
RETURNS TABLE(pedido jsonb, total_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_digits text := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g');
BEGIN
  IF NOT public.equipe_autorizada() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe.';
  END IF;

  RETURN QUERY
  WITH filtrado AS (
    SELECT p.*
    FROM public.pedidos p
    WHERE (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR p.status = ANY (p_statuses))
      AND (
        v_busca IS NULL
        OR p.numero_pedido ILIKE '%' || v_busca || '%'
        OR coalesce(p.itens->'cliente'->>'nome', '') ILIKE '%' || v_busca || '%'
        OR coalesce(p.itens->'cliente'->>'cidade', '') ILIKE '%' || v_busca || '%'
        OR (
          v_digits <> ''
          AND public.normalizar_telefone(p.itens->'cliente'->>'telefone')
              LIKE '%' || v_digits || '%'
        )
      )
  ),
  pagina AS (
    SELECT f.*, count(*) OVER () AS total
    FROM filtrado f
    ORDER BY f.criado_em DESC
    OFFSET greatest(coalesce(p_offset, 0), 0)
    LIMIT least(greatest(coalesce(p_limit, 25), 1), 100)
  )
  SELECT
    to_jsonb(pg.*) - 'total'
      || jsonb_build_object(
        'pedido_status_historico',
        coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'de', h.de, 'para', h.para, 'criado_em', h.criado_em,
            'observacao', h.observacao, 'por_usuario', h.por_usuario
          ) ORDER BY h.criado_em)
          FROM public.pedido_status_historico h
          WHERE h.pedido_id = pg.id
        ), '[]'::jsonb)
      ),
    pg.total
  FROM pagina pg;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_clientes(text, integer, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.metricas_dashboard() FROM public, anon;
REVOKE ALL ON FUNCTION public.listar_pedidos(text[], text, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.listar_clientes(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.metricas_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_pedidos(text[], text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalizar_telefone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipe_autorizada() TO authenticated;