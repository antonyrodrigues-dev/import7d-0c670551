-- Vitrine pública: apenas colunas necessárias ao catálogo.
CREATE OR REPLACE VIEW public.catalogo_publico
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  p.slug,
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
    SELECT jsonb_agg(jsonb_build_object('tamanho', v.tamanho, 'disponivel', GREATEST(v.disponivel, 0))
                     ORDER BY v.tamanho)
      FROM public.produto_variacoes v
     WHERE v.produto_id = p.id
       AND v.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')
  ), '[]'::jsonb) AS variacoes
FROM public.produtos p
WHERE p.ativo = TRUE
  AND p.arquivado_em IS NULL;

REVOKE ALL ON public.catalogo_publico FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.catalogo_publico TO anon, authenticated;

-- Anon não acessa mais as tabelas internas diretamente.
REVOKE ALL ON public.produtos FROM anon;
REVOKE ALL ON public.produto_variacoes FROM anon;