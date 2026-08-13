-- 1) Vitrine pública com modo prévia -------------------------------------
DROP VIEW IF EXISTS public.catalogo_publico;

CREATE VIEW public.catalogo_publico
WITH (security_invoker = false) AS
SELECT
  p.slug,
  p.nome,
  p.categoria,
  p.colecao,
  p.cor,
  p.marca,
  p.descricao,
  p.imagens,
  CASE WHEN p.preco_status = 'confirmado' AND COALESCE(p.preco,0) > 0 THEN p.preco END AS preco,
  CASE WHEN p.preco_status = 'confirmado' AND COALESCE(p.preco,0) > 0 THEN p.preco_cartao END AS preco_cartao,
  CASE WHEN p.preco_status = 'confirmado' AND COALESCE(p.preco,0) > 0 THEN p.parcelamento END AS parcelamento,
  (p.preco_status = 'confirmado' AND COALESCE(p.preco,0) > 0) AS preco_confirmado,
  p.destaque,
  p.modelo_estoque,
  p.criado_em,
  (
    public.produto_publicavel(p.*)
    AND EXISTS (
      SELECT 1 FROM public.produto_variacoes v
       WHERE v.produto_id = p.id
         AND v.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')
         AND (CASE WHEN p.modelo_estoque = 'kit'
                   THEN public.kit_disponivel(p.id, v.tamanho)
                   ELSE GREATEST(COALESCE(v.disponivel,0),0) END) > 0)
  ) AS compravel,
  CASE
    WHEN public.produto_publicavel(p.*)
     AND EXISTS (
       SELECT 1 FROM public.produto_variacoes v
        WHERE v.produto_id = p.id
          AND v.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')
          AND (CASE WHEN p.modelo_estoque = 'kit'
                    THEN public.kit_disponivel(p.id, v.tamanho)
                    ELSE GREATEST(COALESCE(v.disponivel,0),0) END) > 0)
    THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'tamanho', v.tamanho,
               'disponivel', CASE WHEN p.modelo_estoque = 'kit'
                                  THEN public.kit_disponivel(p.id, v.tamanho)
                                  ELSE GREATEST(v.disponivel,0) END) ORDER BY v.tamanho)
        FROM public.produto_variacoes v
       WHERE v.produto_id = p.id
         AND v.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')
         AND (CASE WHEN p.modelo_estoque = 'kit'
                   THEN public.kit_disponivel(p.id, v.tamanho)
                   ELSE GREATEST(COALESCE(v.disponivel,0),0) END) > 0), '[]'::jsonb)
    ELSE '[]'::jsonb
  END AS variacoes
FROM public.produtos p
WHERE p.arquivado_em IS NULL
  AND jsonb_array_length(COALESCE(p.imagens,'[]'::jsonb)) > 0
  AND COALESCE(btrim(p.nome),'') <> ''
  AND COALESCE(btrim(p.categoria),'') <> '';

GRANT SELECT ON public.catalogo_publico TO anon, authenticated;
GRANT SELECT ON public.catalogo_publico TO service_role;

-- 2) Regras de preço por categoria ---------------------------------------
CREATE TABLE IF NOT EXISTS public.regras_preco_categoria (
  categoria text PRIMARY KEY,
  preco numeric NOT NULL CHECK (preco > 0),
  preco_cartao numeric CHECK (preco_cartao IS NULL OR preco_cartao > 0),
  parcelamento text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

GRANT SELECT ON public.regras_preco_categoria TO authenticated;
GRANT ALL ON public.regras_preco_categoria TO service_role;
ALTER TABLE public.regras_preco_categoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe lê regras de preço"
  ON public.regras_preco_categoria FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));

CREATE TABLE IF NOT EXISTS public.regras_preco_aplicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  preco numeric NOT NULL,
  preco_cartao numeric,
  parcelamento text,
  afetados int NOT NULL,
  incluiu_confirmados boolean NOT NULL DEFAULT false,
  por_usuario uuid,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.regras_preco_aplicacoes TO authenticated;
GRANT ALL ON public.regras_preco_aplicacoes TO service_role;
ALTER TABLE public.regras_preco_aplicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin Master lê histórico de regras"
  ON public.regras_preco_aplicacoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_regras_preco_atualizado
  BEFORE UPDATE ON public.regras_preco_categoria
  FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

-- 3) Prévia da regra ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.previsualizar_regra_preco(
  p_categoria text, p_incluir_confirmados boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_afetados int; v_confirmados int; v_total int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master gerencia regras de preço.' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) FILTER (WHERE p_incluir_confirmados OR preco_status <> 'confirmado'),
         count(*) FILTER (WHERE preco_status = 'confirmado'),
         count(*)
    INTO v_afetados, v_confirmados, v_total
    FROM public.produtos
   WHERE arquivado_em IS NULL AND categoria = p_categoria;
  RETURN jsonb_build_object('categoria', p_categoria, 'afetados', COALESCE(v_afetados,0),
                            'confirmados', COALESCE(v_confirmados,0), 'total', COALESCE(v_total,0));
END $$;

REVOKE ALL ON FUNCTION public.previsualizar_regra_preco(text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.previsualizar_regra_preco(text, boolean) TO authenticated;

-- 4) Aplicação transacional ----------------------------------------------
CREATE OR REPLACE FUNCTION public.aplicar_regra_preco(
  p_categoria text, p_preco numeric, p_preco_cartao numeric DEFAULT NULL,
  p_parcelamento text DEFAULT NULL, p_incluir_confirmados boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_afetados int := 0; v_skus text[];
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master gerencia regras de preço.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(btrim(p_categoria),'') = '' THEN
    RAISE EXCEPTION 'Categoria obrigatória.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_preco,0) <= 0 THEN
    RAISE EXCEPTION 'Preço deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF p_preco_cartao IS NOT NULL AND p_preco_cartao <= 0 THEN
    RAISE EXCEPTION 'Preço no cartão deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.regras_preco_categoria (categoria, preco, preco_cartao, parcelamento, atualizado_por)
  VALUES (p_categoria, p_preco, p_preco_cartao, NULLIF(btrim(COALESCE(p_parcelamento,'')),''), v_uid)
  ON CONFLICT (categoria) DO UPDATE
    SET preco = EXCLUDED.preco, preco_cartao = EXCLUDED.preco_cartao,
        parcelamento = EXCLUDED.parcelamento, atualizado_por = v_uid, atualizado_em = now();

  WITH alvo AS (
    SELECT id, sku FROM public.produtos
     WHERE arquivado_em IS NULL AND categoria = p_categoria
       AND (p_incluir_confirmados OR preco_status <> 'confirmado')
     FOR UPDATE
  ), upd AS (
    UPDATE public.produtos pr
       SET preco = p_preco,
           preco_cartao = COALESCE(p_preco_cartao, p_preco),
           parcelamento = NULLIF(btrim(COALESCE(p_parcelamento,'')),''),
           preco_status = 'confirmado',
           atualizado_em = now()
      FROM alvo a WHERE pr.id = a.id
    RETURNING a.sku
  )
  SELECT count(*)::int, COALESCE(array_agg(sku), '{}') INTO v_afetados, v_skus FROM upd;

  INSERT INTO public.regras_preco_aplicacoes
    (categoria, preco, preco_cartao, parcelamento, afetados, incluiu_confirmados, por_usuario, detalhe)
  VALUES (p_categoria, p_preco, p_preco_cartao,
          NULLIF(btrim(COALESCE(p_parcelamento,'')),''), v_afetados,
          COALESCE(p_incluir_confirmados,false), v_uid,
          jsonb_build_object('skus', to_jsonb(v_skus)));

  RETURN jsonb_build_object('categoria', p_categoria, 'afetados', v_afetados, 'skus', to_jsonb(v_skus));
END $$;

REVOKE ALL ON FUNCTION public.aplicar_regra_preco(text, numeric, numeric, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_regra_preco(text, numeric, numeric, text, boolean) TO authenticated;