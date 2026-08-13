CREATE OR REPLACE FUNCTION public.diagnostico_catalogo()
RETURNS TABLE(
  id uuid, sku text, nome text, categoria text, marca text,
  ativo boolean, arquivado boolean, status_publicacao text,
  preco numeric, preco_cartao numeric, preco_status text,
  modelo_estoque text, quantidade_conferida boolean,
  foto_principal text, fotos integer,
  tamanhos jsonb,
  quantidade integer, reservada integer, quarentena integer, disponivel integer,
  can_publish boolean, missing_fields text[], blocking_reasons text[], situacao text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH agg AS (
    SELECT p.id AS pid, p AS prod,
      COALESCE(jsonb_agg(jsonb_build_object(
        'tamanho', v.tamanho, 'origem', v.origem_tamanho,
        'evidencia', v.origem_tamanho_evidencia,
        'quantidade', v.quantidade, 'reservada', v.quantidade_reservada,
        'quarentena', v.quantidade_quarentena, 'disponivel', GREATEST(v.disponivel,0)
      ) ORDER BY v.tamanho) FILTER (WHERE v.id IS NOT NULL), '[]'::jsonb) AS tamanhos,
      COALESCE(sum(v.quantidade), 0)::int AS qtd,
      COALESCE(sum(v.quantidade_reservada), 0)::int AS res,
      COALESCE(sum(v.quantidade_quarentena), 0)::int AS quar,
      COALESCE(sum(GREATEST(v.disponivel,0)), 0)::int AS disp,
      count(v.id) FILTER (WHERE v.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao'))::int AS tam_ok,
      count(v.id)::int AS tam_total
    FROM public.produtos p
    LEFT JOIN public.produto_variacoes v ON v.produto_id = p.id
    GROUP BY p.id, p.*
  ), calc AS (
    SELECT a.*, (a.prod).* ,
      (CASE WHEN (a.prod).preco_status <> 'confirmado' OR COALESCE((a.prod).preco,0) <= 0 THEN ARRAY['preco'] ELSE '{}' END
       || CASE WHEN a.tam_ok = 0 THEN ARRAY['tamanho'] ELSE '{}' END
       || CASE WHEN NOT (a.prod).quantidade_conferida THEN ARRAY['quantidade'] ELSE '{}' END
       || CASE WHEN jsonb_array_length(COALESCE((a.prod).imagens,'[]'::jsonb)) = 0 THEN ARRAY['foto'] ELSE '{}' END
      )::text[] AS missing
    FROM agg a
  )
  SELECT c.id, c.sku, c.nome, c.categoria, c.marca,
    c.ativo, c.arquivado_em IS NOT NULL,
    c.status_publicacao, c.preco, c.preco_cartao, c.preco_status,
    c.modelo_estoque, c.quantidade_conferida,
    NULLIF(COALESCE(c.imagens->>0, ''), ''),
    jsonb_array_length(COALESCE(c.imagens,'[]'::jsonb))::int,
    c.tamanhos, c.qtd, c.res, c.quar, c.disp,
    (c.missing = '{}' AND c.arquivado_em IS NULL AND c.disp > 0) AS can_publish,
    c.missing,
    (CASE WHEN c.arquivado_em IS NOT NULL THEN ARRAY['Produto arquivado'] ELSE '{}' END
     || CASE WHEN 'preco' = ANY(c.missing) THEN ARRAY['Preço pendente de confirmação'] ELSE '{}' END
     || CASE WHEN c.tam_total = 0 THEN ARRAY['Nenhum tamanho cadastrado']
             WHEN c.tam_ok = 0 THEN ARRAY['Tamanho não confirmado fisicamente'] ELSE '{}' END
     || CASE WHEN 'quantidade' = ANY(c.missing) THEN ARRAY['Quantidade não conferida'] ELSE '{}' END
     || CASE WHEN 'foto' = ANY(c.missing) THEN ARRAY['Sem foto principal'] ELSE '{}' END
     || CASE WHEN c.tam_total > 0 AND c.disp <= 0 THEN
              CASE WHEN c.res > 0 THEN ARRAY['Sem saldo: peça reservada']
                   WHEN c.quar > 0 THEN ARRAY['Sem saldo: peça em quarentena']
                   ELSE ARRAY['Sem saldo: peça vendida'] END ELSE '{}' END
     || CASE WHEN c.status_publicacao <> 'publicado' THEN ARRAY['Status de publicação: ' || c.status_publicacao] ELSE '{}' END
     || CASE WHEN NOT c.ativo AND c.arquivado_em IS NULL THEN ARRAY['Produto inativo no painel'] ELSE '{}' END
    )::text[],
    (CASE
      WHEN c.arquivado_em IS NOT NULL THEN 'ARQUIVADO'
      WHEN c.missing = '{}' AND c.disp > 0 AND c.ativo AND c.status_publicacao = 'publicado' THEN 'ACTIVE_VALID'
      WHEN c.ativo AND c.status_publicacao = 'publicado' THEN 'ACTIVE_INVALID'
      WHEN c.missing = '{}' AND c.disp > 0 THEN 'INACTIVE_READY'
      WHEN 'foto' = ANY(c.missing) THEN 'INACTIVE_PHOTO_PENDING'
      WHEN 'preco' = ANY(c.missing) AND 'tamanho' = ANY(c.missing) THEN 'INACTIVE_PHYSICAL_CHECK'
      WHEN 'preco' = ANY(c.missing) THEN 'INACTIVE_PRICE_PENDING'
      WHEN 'tamanho' = ANY(c.missing) THEN 'INACTIVE_SIZE_PENDING'
      WHEN 'quantidade' = ANY(c.missing) THEN 'INACTIVE_PHYSICAL_CHECK'
      ELSE 'PREVIEW_READY' END)
  FROM calc c
  ORDER BY c.sku;
$$;

REVOKE ALL ON FUNCTION public.diagnostico_catalogo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnostico_catalogo() TO authenticated, service_role;