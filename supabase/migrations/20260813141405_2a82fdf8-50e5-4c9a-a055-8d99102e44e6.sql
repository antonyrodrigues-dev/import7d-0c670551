-- ============================================================
-- 1. EVIDÊNCIA DE CONFERÊNCIA DE TAMANHO
-- ============================================================
ALTER TABLE public.produto_variacoes
  ADD COLUMN IF NOT EXISTS origem_tamanho_evidencia text,
  ADD COLUMN IF NOT EXISTS origem_tamanho_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem_tamanho_confirmado_por uuid;

ALTER TABLE public.produto_variacoes ALTER COLUMN origem_tamanho SET DEFAULT 'a_confirmar';

COMMENT ON COLUMN public.produto_variacoes.origem_tamanho_evidencia IS
'Prova da conferência de tamanho. Sem evidência, origem_tamanho NÃO pode ser confirmado_etiqueta/confirmado_medicao.';

-- ============================================================
-- 2. RECONCILIAÇÃO DOS "confirmado_etiqueta" HERDADOS
--    Evidência real (planilha oficial): apenas 3 SKUs com etiqueta legível na imagem.
-- ============================================================
UPDATE public.produto_variacoes v
   SET origem_tamanho_evidencia = 'Etiqueta legível na imagem do produto (planilha oficial 7D — Fonte do tamanho)',
       origem_tamanho_confirmado_em = COALESCE(origem_tamanho_confirmado_em, now())
  FROM public.produtos p
 WHERE p.id = v.produto_id
   AND v.origem_tamanho = 'confirmado_etiqueta'
   AND (p.sku, v.tamanho) IN (('7D-TEE-EA7-001','G'), ('7D-JKT-ZARA-001','GG'), ('7D-SWT-TH-003','P'));

UPDATE public.produto_variacoes
   SET origem_tamanho = 'a_confirmar',
       origem_tamanho_evidencia = 'Reconciliado: valor herdado do DEFAULT inseguro da migration 20260805114040 (sem evidência física).',
       atualizado_em = now()
 WHERE origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')
   AND origem_tamanho_evidencia IS NULL;

-- Trava: só confirma tamanho com evidência registrada
CREATE OR REPLACE FUNCTION public.guard_origem_tamanho()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')
     AND COALESCE(btrim(NEW.origem_tamanho_evidencia), '') = '' THEN
    RAISE EXCEPTION 'Tamanho confirmado exige evidência (origem_tamanho_evidencia).';
  END IF;
  IF NEW.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')
     AND NEW.origem_tamanho_confirmado_em IS NULL THEN
    NEW.origem_tamanho_confirmado_em := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_origem_tamanho ON public.produto_variacoes;
CREATE TRIGGER trg_guard_origem_tamanho
BEFORE INSERT OR UPDATE ON public.produto_variacoes
FOR EACH ROW EXECUTE FUNCTION public.guard_origem_tamanho();

-- ============================================================
-- 3. GATE CANÔNICO COM DIAGNÓSTICO
-- ============================================================
CREATE OR REPLACE FUNCTION public.avaliar_publicacao(p_produto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p public.produtos;
  v_missing text[] := '{}';
  v_block text[] := '{}';
  v_tam_ok int;
  v_tam_total int;
  v_disp int;
BEGIN
  SELECT * INTO p FROM public.produtos WHERE id = p_produto_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('canPublish', false, 'missingFields', jsonb_build_array('produto'),
                              'blockingReasons', jsonb_build_array('Produto inexistente'));
  END IF;

  SELECT count(*) FILTER (WHERE origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')),
         count(*),
         COALESCE(sum(GREATEST(disponivel,0)), 0)
    INTO v_tam_ok, v_tam_total, v_disp
    FROM public.produto_variacoes WHERE produto_id = p.id;

  IF p.arquivado_em IS NOT NULL THEN
    v_block := v_block || 'Produto arquivado';
  END IF;
  IF p.preco_status <> 'confirmado' OR COALESCE(p.preco,0) <= 0 THEN
    v_missing := v_missing || 'preco';
    v_block := v_block || 'Preço pendente de confirmação';
  END IF;
  IF v_tam_total = 0 THEN
    v_missing := v_missing || 'tamanho';
    v_block := v_block || 'Nenhum tamanho cadastrado';
  ELSIF v_tam_ok = 0 THEN
    v_missing := v_missing || 'tamanho';
    v_block := v_block || 'Tamanho não confirmado fisicamente';
  END IF;
  IF NOT p.quantidade_conferida THEN
    v_missing := v_missing || 'quantidade';
    v_block := v_block || 'Quantidade não conferida';
  END IF;
  IF jsonb_array_length(COALESCE(p.imagens,'[]'::jsonb)) = 0 THEN
    v_missing := v_missing || 'foto';
    v_block := v_block || 'Sem foto principal';
  END IF;
  IF v_disp <= 0 AND v_tam_total > 0 THEN
    v_block := v_block || 'Sem saldo disponível (vendido, reservado ou em quarentena)';
  END IF;
  IF p.status_publicacao <> 'publicado' THEN
    v_block := v_block || ('Status de publicação: ' || p.status_publicacao);
  END IF;
  IF NOT p.ativo THEN
    v_block := v_block || 'Produto inativo';
  END IF;

  RETURN jsonb_build_object(
    'canPublish', (v_missing = '{}' AND p.arquivado_em IS NULL AND v_disp > 0),
    'missingFields', to_jsonb(v_missing),
    'blockingReasons', to_jsonb(v_block)
  );
END $$;

REVOKE ALL ON FUNCTION public.avaliar_publicacao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avaliar_publicacao(uuid) TO authenticated, service_role;

-- ============================================================
-- 4. CATÁLOGO PREVIEW (conferência comercial, sem venda)
-- ============================================================
DROP VIEW IF EXISTS public.catalogo_preview;
CREATE VIEW public.catalogo_preview
WITH (security_invoker = false, security_barrier = true) AS
  SELECT p.slug, p.nome, p.categoria, p.colecao, p.cor, p.marca, p.descricao,
         p.imagens, p.modelo_estoque, p.destaque, p.criado_em,
         CASE WHEN p.preco_status = 'confirmado' AND p.preco > 0 THEN p.preco END AS preco,
         CASE WHEN p.preco_status = 'confirmado' AND p.preco > 0 THEN p.preco_cartao END AS preco_cartao,
         CASE WHEN p.preco_status = 'confirmado' AND p.preco > 0 THEN p.parcelamento END AS parcelamento,
         false AS compravel,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object('tamanho', v.tamanho,
                                               'confirmado', v.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao'))
                            ORDER BY v.tamanho)
             FROM public.produto_variacoes v
            WHERE v.produto_id = p.id
              AND v.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')
         ), '[]'::jsonb) AS variacoes
    FROM public.produtos p
   WHERE p.arquivado_em IS NULL
     AND NOT public.produto_publicavel(p)
     AND jsonb_array_length(COALESCE(p.imagens,'[]'::jsonb)) > 0;

COMMENT ON VIEW public.catalogo_preview IS
'Catálogo em conferência: produtos reais ainda fora do gate de produção. Nunca comprável, nunca reserva estoque, nunca expõe tamanho estimado como confirmado.';

REVOKE ALL ON public.catalogo_preview FROM PUBLIC;
GRANT SELECT ON public.catalogo_preview TO authenticated, service_role;

-- ============================================================
-- 5. RESUMO DE QUALIDADE DO CATÁLOGO (Admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.qualidade_catalogo()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT p AS prod,
           p.arquivado_em, p.status_publicacao, p.preco_status, p.preco,
           p.quantidade_conferida, p.imagens, p.nome,
           (SELECT count(*) FROM public.produto_variacoes v WHERE v.produto_id = p.id) AS tam_total,
           (SELECT count(*) FROM public.produto_variacoes v WHERE v.produto_id = p.id
              AND v.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')) AS tam_ok,
           (SELECT COALESCE(sum(GREATEST(v.disponivel,0)),0) FROM public.produto_variacoes v WHERE v.produto_id = p.id) AS disp,
           (SELECT COALESCE(sum(v.quantidade_reservada),0) FROM public.produto_variacoes v WHERE v.produto_id = p.id) AS reserv,
           (SELECT COALESCE(sum(v.quantidade_quarentena),0) FROM public.produto_variacoes v WHERE v.produto_id = p.id) AS quar
      FROM public.produtos p
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM base),
    'arquivados', (SELECT count(*) FROM base WHERE arquivado_em IS NOT NULL),
    'ativosValidos', (SELECT count(*) FROM base b WHERE public.produto_publicavel(b.prod) AND b.disp > 0),
    'preview', (SELECT count(*) FROM base b WHERE b.arquivado_em IS NULL AND NOT public.produto_publicavel(b.prod) AND jsonb_array_length(COALESCE(b.imagens,'[]'::jsonb)) > 0),
    'rascunhos', (SELECT count(*) FROM base WHERE arquivado_em IS NULL AND status_publicacao <> 'publicado'),
    'semPreco', (SELECT count(*) FROM base WHERE arquivado_em IS NULL AND (preco_status <> 'confirmado' OR COALESCE(preco,0) <= 0)),
    'semTamanho', (SELECT count(*) FROM base WHERE arquivado_em IS NULL AND tam_ok = 0),
    'semFoto', (SELECT count(*) FROM base WHERE arquivado_em IS NULL AND jsonb_array_length(COALESCE(imagens,'[]'::jsonb)) = 0),
    'semQuantidadeConferida', (SELECT count(*) FROM base WHERE arquivado_em IS NULL AND NOT quantidade_conferida),
    'duplicidades', (SELECT COALESCE(sum(c - 1),0) FROM (SELECT count(*) c FROM public.produtos WHERE arquivado_em IS NULL GROUP BY lower(nome) HAVING count(*) > 1) d),
    'vendidos', (SELECT count(*) FROM base WHERE arquivado_em IS NULL AND tam_total > 0 AND disp = 0 AND reserv = 0 AND quar = 0),
    'reservados', (SELECT COALESCE(sum(reserv),0) FROM base),
    'quarentena', (SELECT COALESCE(sum(quar),0) FROM base)
  )
$$;

REVOKE ALL ON FUNCTION public.qualidade_catalogo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qualidade_catalogo() TO authenticated, service_role;