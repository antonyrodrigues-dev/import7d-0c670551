-- ============================================================
-- BLOCO 1 — PUBLISH GATE CANÔNICO
-- ============================================================

CREATE OR REPLACE FUNCTION public.produto_publicavel(p public.produtos)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT p.ativo
     AND p.arquivado_em IS NULL
     AND p.status_publicacao = 'publicado'
     AND p.preco_status = 'confirmado'
     AND p.quantidade_conferida
     AND p.preco > 0
$$;

COMMENT ON FUNCTION public.produto_publicavel(public.produtos) IS
'Fonte canônica do publish gate de PRODUTO. Usada por catalogo_publico, criar_pedido, importador e ação Publicar.';

CREATE OR REPLACE FUNCTION public.variacao_publicavel(v public.produto_variacoes)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT v.origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao')
     AND COALESCE(v.disponivel, 0) > 0
$$;

COMMENT ON FUNCTION public.variacao_publicavel(public.produto_variacoes) IS
'Fonte canônica do publish gate de VARIAÇÃO (tamanho confirmado + saldo disponível).';

GRANT EXECUTE ON FUNCTION public.produto_publicavel(public.produtos) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.variacao_publicavel(public.produto_variacoes) TO authenticated, service_role;

DROP VIEW IF EXISTS public.catalogo_publico;
CREATE VIEW public.catalogo_publico
WITH (security_invoker = false, security_barrier = true) AS
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
           SELECT jsonb_agg(jsonb_build_object('tamanho', v.tamanho,
                                               'disponivel', GREATEST(v.disponivel, 0))
                            ORDER BY v.tamanho)
             FROM public.produto_variacoes v
            WHERE v.produto_id = p.id
              AND public.variacao_publicavel(v)
         ), '[]'::jsonb) AS variacoes
    FROM public.produtos p
   WHERE public.produto_publicavel(p)
     AND EXISTS (SELECT 1 FROM public.produto_variacoes v
                  WHERE v.produto_id = p.id AND public.variacao_publicavel(v));

COMMENT ON VIEW public.catalogo_publico IS
'Vitrine pública. View privilegiada (security_invoker=false, security_barrier=true), somente leitura, sem DML, projetando apenas colunas de vitrine. O publish gate é aplicado pelas funções canônicas produto_publicavel/variacao_publicavel. Modo privilegiado justificado: anon não possui (e não deve possuir) GRANT algum em produtos/produto_variacoes.';

REVOKE ALL ON public.catalogo_publico FROM PUBLIC;
GRANT SELECT ON public.catalogo_publico TO anon, authenticated, service_role;

-- ============================================================
-- BLOCO 4 — expiração pontual (checkout não varre a loja inteira)
-- ============================================================

CREATE OR REPLACE FUNCTION public.expirar_reservas_variacao(p_produto_id uuid, p_tamanho text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r record; v_count int := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.reservas_estoque
     WHERE produto_id = p_produto_id AND tamanho = p_tamanho
       AND estado = 'reservada_temporariamente' AND expira_em < now()
     ORDER BY id FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.produto_variacoes
       SET quantidade_reservada = GREATEST(0, quantidade_reservada - r.quantidade),
           atualizado_em = now()
     WHERE produto_id = r.produto_id AND tamanho = r.tamanho;
    UPDATE public.reservas_estoque SET estado = 'expirada', atualizado_em = now() WHERE id = r.id;
    INSERT INTO public.produto_movimentacoes
      (produto_id, tamanho, tipo, quantidade, motivo, observacao, pedido_id)
    VALUES (r.produto_id, r.tamanho, 'liberacao_reserva', r.quantidade,
            'expiracao', 'Reserva temporária expirada (revalidação de checkout)', r.pedido_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.expirar_reservas_variacao(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expirar_reservas_variacao(uuid, text) TO service_role;

-- ============================================================
-- BLOCO 2 + 3 + 4 — criar_pedido: publish gate, peça única = 1,
-- sem varredura global de reservas
-- ============================================================

CREATE OR REPLACE FUNCTION public.criar_pedido(p_itens jsonb, p_cliente jsonb, p_entrega jsonb, p_pagamento jsonb, p_observacoes text DEFAULT NULL::text, p_canal text DEFAULT 'whatsapp'::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, numero_pedido text, valor_total numeric, frete_status text, snapshot jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_subtotal numeric := 0;
  v_item jsonb;
  v_slug text;
  v_size text;
  v_qty int;
  v_total_qty int := 0;
  v_itens_oficiais jsonb := '[]'::jsonb;
  v_metodo_entrega text;
  v_metodo_pagto text;
  v_parcelas int;
  v_tel text;
  v_cpf text;
  v_end jsonb;
  v_ret jsonb;
  v_prod record;
  v_var record;
  v_saldo int;
  v_agg jsonb := '{}'::jsonb;
  v_chave text;
  v_reservas jsonb := '[]'::jsonb;
  v_res jsonb;
  v_expira timestamptz;
BEGIN
  PERFORM public.validar_checkout_key(p_idempotency_key);

  SELECT * INTO v_pedido FROM public.pedidos p WHERE p.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.valor_total,
                        v_pedido.frete_status, public.pedido_snapshot(v_pedido);
    RETURN;
  END IF;

  p_canal := COALESCE(NULLIF(p_canal,''), 'whatsapp');
  IF p_canal NOT IN ('whatsapp','site','loja') THEN
    RAISE EXCEPTION 'Canal não permitido.' USING ERRCODE = '22023';
  END IF;

  IF p_cliente IS NULL THEN
    RAISE EXCEPTION 'Dados do cliente obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(btrim(p_cliente->>'nome'),'') = '' OR length(p_cliente->>'nome') > 120 THEN
    RAISE EXCEPTION 'Nome do cliente inválido.' USING ERRCODE = '22023';
  END IF;
  v_tel := regexp_replace(COALESCE(p_cliente->>'telefone',''), '\D', '', 'g');
  IF length(v_tel) < 10 OR length(v_tel) > 13 THEN
    RAISE EXCEPTION 'Telefone inválido.' USING ERRCODE = '22023';
  END IF;
  v_cpf := regexp_replace(COALESCE(p_cliente->>'cpf',''), '\D', '', 'g');
  IF v_cpf <> '' AND length(v_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido.' USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(p_observacoes,'')) > 500 THEN
    RAISE EXCEPTION 'Observações excedem 500 caracteres.' USING ERRCODE = '22023';
  END IF;

  v_metodo_entrega := COALESCE(p_entrega->>'metodo','');
  IF v_metodo_entrega NOT IN ('entrega','retirada') THEN
    RAISE EXCEPTION 'Método de entrega inválido.' USING ERRCODE = '22023';
  END IF;
  v_end := NULLIF(p_entrega->'endereco','null'::jsonb);
  v_ret := NULLIF(p_entrega->'retirada','null'::jsonb);

  IF v_metodo_entrega = 'entrega' THEN
    IF v_end IS NULL
       OR regexp_replace(COALESCE(v_end->>'cep',''),'\D','','g') !~ '^[0-9]{8}$'
       OR COALESCE(btrim(v_end->>'rua'),'') = ''
       OR COALESCE(btrim(v_end->>'numero'),'') = ''
       OR COALESCE(btrim(v_end->>'bairro'),'') = ''
       OR COALESCE(btrim(v_end->>'cidade'),'') = '' THEN
      RAISE EXCEPTION 'Endereço de entrega incompleto.' USING ERRCODE = '22023';
    END IF;
    v_ret := NULL;
  ELSE
    IF v_ret IS NULL
       OR COALESCE(v_ret->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR COALESCE(v_ret->>'time','') !~ '^[0-9]{2}:[0-9]{2}$' THEN
      RAISE EXCEPTION 'Horário de retirada inválido.' USING ERRCODE = '22023';
    END IF;
    IF (v_ret->>'date')::date < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
      RAISE EXCEPTION 'Horário de retirada expirado.' USING ERRCODE = '22023';
    END IF;
    v_end := NULL;
  END IF;

  v_metodo_pagto := COALESCE(p_pagamento->>'metodo','');
  IF v_metodo_pagto NOT IN ('pix','debito','credito','dinheiro') THEN
    RAISE EXCEPTION 'Forma de pagamento não permitida.' USING ERRCODE = '22023';
  END IF;
  v_parcelas := COALESCE((p_pagamento->>'parcelas')::int, 1);
  IF v_metodo_pagto <> 'credito' THEN v_parcelas := 1; END IF;
  IF v_parcelas < 1 OR v_parcelas > 12 THEN
    RAISE EXCEPTION 'Número de parcelas não permitido.' USING ERRCODE = '22023';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Pedido sem itens.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_itens) > 50 THEN
    RAISE EXCEPTION 'Pedido excede limite de 50 linhas.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_slug := btrim(COALESCE(v_item->>'slug',''));
    v_size := btrim(COALESCE(v_item->>'size',''));
    v_qty  := COALESCE((v_item->>'quantity')::int, 0);
    IF v_slug = '' OR v_size = '' OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item inválido no pedido.' USING ERRCODE = '22023';
    END IF;
    v_chave := v_slug || '||' || v_size;
    v_agg := jsonb_set(v_agg, ARRAY[v_chave],
             to_jsonb(COALESCE((v_agg->>v_chave)::int, 0) + v_qty), true);
  END LOOP;

  FOR v_chave, v_qty IN
    SELECT key, value::int FROM jsonb_each_text(v_agg) ORDER BY key
  LOOP
    v_slug := split_part(v_chave, '||', 1);
    v_size := split_part(v_chave, '||', 2);

    IF v_qty > 10 THEN
      RAISE EXCEPTION 'Quantidade máxima por item é 10 (% tam %).', v_slug, v_size
        USING ERRCODE = '22023';
    END IF;
    v_total_qty := v_total_qty + v_qty;

    SELECT pr.id, pr.slug, pr.nome, pr.preco, pr.modelo_estoque,
           public.produto_publicavel(pr) AS publicavel,
           COALESCE(pr.imagens->>0, '') AS imagem
      INTO v_prod
      FROM public.produtos pr
     WHERE pr.slug = v_slug;
    IF NOT FOUND OR NOT v_prod.publicavel THEN
      RAISE EXCEPTION 'Produto indisponível para venda: %', v_slug USING ERRCODE = '22023';
    END IF;

    IF v_prod.modelo_estoque = 'peca_unica' AND v_qty <> 1 THEN
      RAISE EXCEPTION 'Peça única: apenas 1 unidade por pedido (%).', v_slug USING ERRCODE = '22023';
    END IF;

    PERFORM public.expirar_reservas_variacao(v_prod.id, v_size);

    SELECT pv.disponivel AS disponivel,
           public.variacao_publicavel(pv) AS publicavel
      INTO v_var
      FROM public.produto_variacoes pv
     WHERE pv.produto_id = v_prod.id AND pv.tamanho = v_size
     FOR UPDATE;
    IF NOT FOUND OR NOT v_var.publicavel THEN
      RAISE EXCEPTION 'Tamanho % indisponível para %.', v_size, v_slug USING ERRCODE = '22023';
    END IF;
    v_saldo := v_var.disponivel;
    IF v_saldo < v_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para % tam % (disponível %).', v_slug, v_size, v_saldo
        USING ERRCODE = '22023';
    END IF;

    IF v_prod.modelo_estoque = 'peca_unica' THEN
      v_reservas := v_reservas || jsonb_build_array(jsonb_build_object(
        'produto_id', v_prod.id, 'tamanho', v_size, 'quantidade', v_qty));
    END IF;

    v_subtotal := v_subtotal + (v_prod.preco * v_qty);
    v_itens_oficiais := v_itens_oficiais || jsonb_build_array(jsonb_build_object(
      'slug', v_prod.slug, 'name', v_prod.nome, 'size', v_size,
      'quantity', v_qty, 'price', v_prod.preco, 'image', v_prod.imagem
    ));
  END LOOP;

  IF v_total_qty > 50 THEN
    RAISE EXCEPTION 'Quantidade total do pedido excede 50 peças.' USING ERRCODE = '22023';
  END IF;
  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Valor total inválido.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.pedidos (itens, valor_total, status, canal, idempotency_key, frete_status)
    VALUES (
      jsonb_build_object(
        'produtos', v_itens_oficiais,
        'cliente', jsonb_build_object(
          'nome', btrim(p_cliente->>'nome'), 'telefone', v_tel,
          'cpf', NULLIF(v_cpf,''), 'cidade', p_cliente->>'cidade'
        ),
        'entrega', jsonb_build_object(
          'metodo', v_metodo_entrega, 'endereco', v_end, 'retirada', v_ret,
          'frete', jsonb_build_object('status','pendente','label','A combinar','cost', NULL)
        ),
        'pagamento', jsonb_build_object('metodo', v_metodo_pagto, 'parcelas', v_parcelas),
        'observacoes', NULLIF(btrim(COALESCE(p_observacoes,'')),''),
        'subtotal', v_subtotal, 'frete', 0
      ),
      v_subtotal, 'novo', p_canal, p_idempotency_key, 'pendente'
    )
    RETURNING * INTO v_pedido;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_pedido FROM public.pedidos p WHERE p.idempotency_key = p_idempotency_key;
    IF NOT FOUND THEN RAISE; END IF;
    RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.valor_total,
                        v_pedido.frete_status, public.pedido_snapshot(v_pedido);
    RETURN;
  END;

  v_expira := now() + make_interval(mins => public.reserva_minutos());
  FOR v_res IN SELECT * FROM jsonb_array_elements(v_reservas) LOOP
    UPDATE public.produto_variacoes
       SET quantidade_reservada = quantidade_reservada + (v_res->>'quantidade')::int,
           atualizado_em = now()
     WHERE produto_id = (v_res->>'produto_id')::uuid AND tamanho = v_res->>'tamanho';

    INSERT INTO public.reservas_estoque (pedido_id, produto_id, tamanho, quantidade, expira_em)
    VALUES (v_pedido.id, (v_res->>'produto_id')::uuid, v_res->>'tamanho',
            (v_res->>'quantidade')::int, v_expira);

    INSERT INTO public.produto_movimentacoes
      (produto_id, tamanho, tipo, quantidade, motivo, observacao, pedido_id)
    VALUES ((v_res->>'produto_id')::uuid, v_res->>'tamanho', 'reserva',
            (v_res->>'quantidade')::int, 'checkout',
            format('Reserva temporária do pedido %s', v_pedido.numero_pedido), v_pedido.id);
  END LOOP;

  INSERT INTO public.pedido_pagamentos (pedido_id, estado, metodo, valor, parcelas, observacao)
  VALUES (v_pedido.id, 'pendente', v_metodo_pagto, v_subtotal, v_parcelas, 'Pedido criado');

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pedido.criado', 'cliente',
          jsonb_build_object('canal', p_canal, 'itens', jsonb_array_length(v_itens_oficiais),
                             'reservas', jsonb_array_length(v_reservas)));

  RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.valor_total,
                      v_pedido.frete_status, public.pedido_snapshot(v_pedido);
END $function$;

REVOKE ALL ON FUNCTION public.criar_pedido(jsonb, jsonb, jsonb, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_pedido(jsonb, jsonb, jsonb, jsonb, text, text, text) TO anon, authenticated, service_role;

-- ============================================================
-- BLOCO 6 — produto e estoque: escrita Admin Master only
-- ============================================================

DROP POLICY IF EXISTS "Staff can insert products" ON public.produtos;
DROP POLICY IF EXISTS "Staff can update products" ON public.produtos;
CREATE POLICY "Only admin can insert products"
  ON public.produtos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Only admin can update products"
  ON public.produtos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Staff can insert variations" ON public.produto_variacoes;
DROP POLICY IF EXISTS "Staff can update variations" ON public.produto_variacoes;
CREATE POLICY "Only admin can insert variations"
  ON public.produto_variacoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Only admin can update variations"
  ON public.produto_variacoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

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

REVOKE ALL ON FUNCTION public.ajustar_estoque(uuid, text, text, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ajustar_estoque(uuid, text, text, integer, text, uuid) TO authenticated, service_role;

-- ============================================================
-- BLOCO 7 — defaults seguros (não altera linhas existentes)
-- ============================================================

ALTER TABLE public.produtos
  ALTER COLUMN ativo SET DEFAULT false,
  ALTER COLUMN status_publicacao SET DEFAULT 'rascunho',
  ALTER COLUMN preco_status SET DEFAULT 'a_confirmar',
  ALTER COLUMN quantidade_conferida SET DEFAULT false;

ALTER TABLE public.produto_variacoes
  ALTER COLUMN origem_tamanho SET DEFAULT 'a_confirmar';