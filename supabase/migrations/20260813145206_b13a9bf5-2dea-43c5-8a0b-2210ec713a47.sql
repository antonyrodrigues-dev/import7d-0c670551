-- ============================================================
-- ONDA C — Kits / Bundles com estoque derivado dos componentes
-- ============================================================

CREATE TABLE public.produto_kit_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  kit_tamanho text NOT NULL,
  componente_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  componente_tamanho text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT produto_kit_itens_qty_ck CHECK (quantidade > 0 AND quantidade <= 20),
  CONSTRAINT produto_kit_itens_self_ck CHECK (kit_id <> componente_id),
  CONSTRAINT produto_kit_itens_unico UNIQUE (kit_id, kit_tamanho, componente_id, componente_tamanho)
);

GRANT SELECT ON public.produto_kit_itens TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.produto_kit_itens TO authenticated;
GRANT ALL ON public.produto_kit_itens TO service_role;

ALTER TABLE public.produto_kit_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe consulta composicao de kits"
  ON public.produto_kit_itens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));

CREATE POLICY "Admin Master edita composicao de kits"
  ON public.produto_kit_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX produto_kit_itens_kit_idx ON public.produto_kit_itens (kit_id, kit_tamanho);
CREATE INDEX produto_kit_itens_componente_idx ON public.produto_kit_itens (componente_id, componente_tamanho);

CREATE TRIGGER produto_kit_itens_touch
  BEFORE UPDATE ON public.produto_kit_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

-- Integridade estrutural: kit precisa ser kit, componente nunca é kit,
-- e ambas as variações precisam existir de fato.
CREATE OR REPLACE FUNCTION public.guard_kit_composicao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_modelo_kit text;
  v_modelo_comp text;
BEGIN
  SELECT modelo_estoque INTO v_modelo_kit FROM public.produtos WHERE id = NEW.kit_id;
  IF v_modelo_kit IS DISTINCT FROM 'kit' THEN
    RAISE EXCEPTION 'Composição só existe para produtos com modelo de estoque "kit".'
      USING ERRCODE = '23514';
  END IF;

  SELECT modelo_estoque INTO v_modelo_comp FROM public.produtos WHERE id = NEW.componente_id;
  IF v_modelo_comp = 'kit' THEN
    RAISE EXCEPTION 'Um kit não pode conter outro kit.' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.produto_variacoes
     WHERE produto_id = NEW.kit_id AND tamanho = NEW.kit_tamanho
  ) THEN
    RAISE EXCEPTION 'Tamanho % não existe no kit.', NEW.kit_tamanho USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.produto_variacoes
     WHERE produto_id = NEW.componente_id AND tamanho = NEW.componente_tamanho
  ) THEN
    RAISE EXCEPTION 'Tamanho % não existe na peça componente.', NEW.componente_tamanho
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER produto_kit_itens_guard
  BEFORE INSERT OR UPDATE ON public.produto_kit_itens
  FOR EACH ROW EXECUTE FUNCTION public.guard_kit_composicao();

-- Disponibilidade de um kit = menor múltiplo completo entre as peças.
CREATE OR REPLACE FUNCTION public.kit_disponivel(p_kit_id uuid, p_tamanho text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT MIN(GREATEST(COALESCE(pv.disponivel,0),0) / ki.quantidade)
       FROM public.produto_kit_itens ki
       JOIN public.produto_variacoes pv
         ON pv.produto_id = ki.componente_id AND pv.tamanho = ki.componente_tamanho
      WHERE ki.kit_id = p_kit_id AND ki.kit_tamanho = p_tamanho),
    0)::int
$$;

-- Explode um item de pedido nas linhas físicas de estoque que ele consome.
-- Produto normal → ele mesmo. Kit → as peças componentes.
CREATE OR REPLACE FUNCTION public.explodir_item_pedido(p_slug text, p_size text, p_qty integer)
RETURNS TABLE(produto_id uuid, tamanho text, quantidade integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_modelo text;
BEGIN
  SELECT p.id, p.modelo_estoque INTO v_id, v_modelo
    FROM public.produtos p WHERE p.slug = p_slug;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Produto do pedido não localizado (%).', p_slug USING ERRCODE = 'P0002';
  END IF;

  IF v_modelo <> 'kit' THEN
    RETURN QUERY SELECT v_id, p_size, p_qty;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT ki.componente_id, ki.componente_tamanho, (ki.quantidade * p_qty)::int
      FROM public.produto_kit_itens ki
     WHERE ki.kit_id = v_id AND ki.kit_tamanho = p_size;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kit % (tam %) está sem composição cadastrada.', p_slug, p_size
      USING ERRCODE = '23514';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.kit_disponivel(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.explodir_item_pedido(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kit_disponivel(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.explodir_item_pedido(text, text, integer) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Kit não tem estoque próprio: bloqueia movimentação manual.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ajustar_estoque(p_produto_id uuid, p_tamanho text, p_tipo text, p_qty integer, p_observacao text DEFAULT NULL::text, p_pedido_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current int;
  v_new int;
  v_delta int;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master ajusta estoque.' USING ERRCODE = '42501';
  END IF;
  IF p_tipo NOT IN ('entrada','saida','ajuste','reposicao','consumo_pedido') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_tipo;
  END IF;
  IF p_qty < 0 THEN
    RAISE EXCEPTION 'Quantidade não pode ser negativa.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.produtos WHERE id = p_produto_id AND modelo_estoque = 'kit') THEN
    RAISE EXCEPTION 'Kit não possui estoque próprio: movimente as peças que o compõem.'
      USING ERRCODE = '23514';
  END IF;

  SELECT quantidade INTO v_current
    FROM public.produto_variacoes
   WHERE produto_id = p_produto_id AND tamanho = p_tamanho
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade)
    VALUES (p_produto_id, p_tamanho, 0)
    RETURNING quantidade INTO v_current;
  END IF;

  v_new := CASE p_tipo
    WHEN 'ajuste' THEN p_qty
    WHEN 'entrada' THEN v_current + p_qty
    WHEN 'reposicao' THEN v_current + p_qty
    WHEN 'saida' THEN v_current - p_qty
    WHEN 'consumo_pedido' THEN v_current - p_qty
  END;

  IF v_new < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente (atual %, solicitado %).', v_current, p_qty;
  END IF;

  v_delta := v_new - v_current;

  UPDATE public.produto_variacoes
     SET quantidade = v_new
   WHERE produto_id = p_produto_id AND tamanho = p_tamanho;

  IF v_delta <> 0 THEN
    INSERT INTO public.produto_movimentacoes
      (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id)
    VALUES
      (p_produto_id, p_tamanho, p_tipo, v_delta, v_uid, p_observacao, p_pedido_id);
  END IF;

  RETURN v_new;
END $function$;

-- ------------------------------------------------------------
-- Gate de publicação ciente de kits.
-- ------------------------------------------------------------
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
      v_missing := v_missing || 'composicao';
      v_block := v_block || 'Kit sem composição cadastrada';
    END IF;
  ELSE
    SELECT COALESCE(sum(GREATEST(disponivel,0)), 0) INTO v_disp
      FROM public.produto_variacoes WHERE produto_id = p.id;
  END IF;

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
    v_block := v_block || CASE WHEN p.modelo_estoque = 'kit'
      THEN 'Sem saldo: alguma peça do kit está indisponível'
      ELSE 'Sem saldo disponível (vendido, reservado ou em quarentena)' END;
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
END $function$;
