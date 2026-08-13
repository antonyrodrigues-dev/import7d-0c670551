CREATE OR REPLACE VIEW public.catalogo_publico AS
SELECT p.slug,
    p.nome,
    p.categoria,
    p.colecao,
    p.cor,
    p.marca,
    p.descricao,
    p.imagens,
    p.preco,
    p.preco_cartao,
    p.parcelamento,
    p.destaque,
    p.modelo_estoque,
    p.criado_em,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'tamanho', v.tamanho,
               'disponivel', CASE
                 WHEN p.modelo_estoque = 'kit' THEN public.kit_disponivel(p.id, v.tamanho)
                 ELSE GREATEST(v.disponivel, 0)
               END) ORDER BY v.tamanho)
        FROM public.produto_variacoes v
       WHERE v.produto_id = p.id
         AND v.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')
         AND CASE
               WHEN p.modelo_estoque = 'kit' THEN public.kit_disponivel(p.id, v.tamanho)
               ELSE GREATEST(COALESCE(v.disponivel,0), 0)
             END > 0
    ), '[]'::jsonb) AS variacoes
   FROM public.produtos p
  WHERE public.produto_publicavel(p.*)
    AND EXISTS (
      SELECT 1 FROM public.produto_variacoes v
       WHERE v.produto_id = p.id
         AND v.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')
         AND CASE
               WHEN p.modelo_estoque = 'kit' THEN public.kit_disponivel(p.id, v.tamanho)
               ELSE GREATEST(COALESCE(v.disponivel,0), 0)
             END > 0
    );