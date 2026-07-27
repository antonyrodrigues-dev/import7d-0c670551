-- =========================================================
-- SPRINT 4 · ONDA 1.1 — Gate real do checkout/pedido
-- =========================================================

-- 1) Colunas de auditoria/declaração e responsável canônico
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS whatsapp_declarado_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_confirmacao_origem text,
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id);

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_wa_origem_check;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_wa_origem_check
  CHECK (whatsapp_confirmacao_origem IS NULL
         OR whatsapp_confirmacao_origem IN ('cliente','equipe'));

-- 2) Trilha de eventos imutável
CREATE TABLE IF NOT EXISTS public.pedido_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  numero_pedido text NOT NULL,
  tipo text NOT NULL,
  origem text NOT NULL,
  por_usuario uuid,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pedido_eventos TO authenticated;
GRANT ALL ON public.pedido_eventos TO service_role;
ALTER TABLE public.pedido_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view order events" ON public.pedido_eventos;
CREATE POLICY "Staff can view order events" ON public.pedido_eventos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));
CREATE INDEX IF NOT EXISTS idx_pedido_eventos_pedido
  ON public.pedido_eventos (pedido_id, criado_em);

-- 3) Guarda reforçada de UPDATE em pedidos.
--    Campos sensíveis só mudam dentro de RPC protegida (GUC app.rpc_ctx).
CREATE OR REPLACE FUNCTION public.pedidos_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_rpc boolean := COALESCE(current_setting('app.rpc_ctx', true), '') = 'on';
BEGIN
  -- Imutáveis SEMPRE (nem RPC altera)
  IF NEW.itens IS DISTINCT FROM OLD.itens THEN
    RAISE EXCEPTION 'Itens do pedido são imutáveis após criação.';
  END IF;
  IF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN
    RAISE EXCEPTION 'Valor total do pedido é imutável após criação.';
  END IF;
  IF NEW.numero_pedido IS DISTINCT FROM OLD.numero_pedido THEN
    RAISE EXCEPTION 'Número do pedido é imutável.';
  END IF;
  IF NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN
    RAISE EXCEPTION 'Chave de idempotência é imutável.';
  END IF;
  IF NEW.criado_em IS DISTINCT FROM OLD.criado_em THEN
    RAISE EXCEPTION 'Data de criação é imutável.';
  END IF;

  -- Campos operacionais: apenas via RPC protegida
  IF NOT v_rpc THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.consumo_aplicado IS DISTINCT FROM OLD.consumo_aplicado
       OR NEW.atendente_nome IS DISTINCT FROM OLD.atendente_nome
       OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
       OR NEW.canal IS DISTINCT FROM OLD.canal
       OR NEW.frete_status IS DISTINCT FROM OLD.frete_status
       OR NEW.whatsapp_declarado_enviado_em IS DISTINCT FROM OLD.whatsapp_declarado_enviado_em
       OR NEW.whatsapp_confirmacao_origem IS DISTINCT FROM OLD.whatsapp_confirmacao_origem THEN
      RAISE EXCEPTION 'Alteração direta em pedidos não é permitida. Use as operações protegidas.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pedido_transicoes
      WHERE de = OLD.status AND para = NEW.status
    ) THEN
      RAISE EXCEPTION 'Transição de status inválida: % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 4) Revoga UPDATE amplo de authenticated sobre pedidos
DROP POLICY IF EXISTS "Staff can update orders" ON public.pedidos;
REVOKE UPDATE, DELETE ON public.pedidos FROM authenticated;
REVOKE INSERT ON public.pedidos FROM authenticated, anon;

-- 5) Helper: valida chave de idempotência do checkout
CREATE OR REPLACE FUNCTION public.validar_checkout_key(p_key text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF p_key IS NULL OR btrim(p_key) = '' THEN
    RAISE EXCEPTION 'Chave da solicitação é obrigatória.' USING ERRCODE = '22023';
  END IF;
  IF length(p_key) < 16 OR length(p_key) > 128 THEN
    RAISE EXCEPTION 'Chave da solicitação inválida.' USING ERRCODE = '22023';
  END IF;
  IF p_key !~ '^[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Chave da solicitação inválida.' USING ERRCODE = '22023';
  END IF;
  -- entropia mínima: ao menos 8 caracteres distintos
  IF (SELECT count(DISTINCT c) FROM regexp_split_to_table(p_key, '') AS c) < 8 THEN
    RAISE EXCEPTION 'Chave da solicitação inválida.' USING ERRCODE = '22023';
  END IF;
END $$;

-- 6) Snapshot oficial do pedido (fonte única para UI e WhatsApp)
CREATE OR REPLACE FUNCTION public.pedido_snapshot(p_pedido public.pedidos)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'id', p_pedido.id,
    'numero_pedido', p_pedido.numero_pedido,
    'status', p_pedido.status,
    'valor_total', p_pedido.valor_total,
    'frete_status', p_pedido.frete_status,
    'criado_em', p_pedido.criado_em,
    'canal', p_pedido.canal,
    'produtos', COALESCE(p_pedido.itens->'produtos', '[]'::jsonb),
    'cliente', COALESCE(p_pedido.itens->'cliente', '{}'::jsonb),
    'entrega', COALESCE(p_pedido.itens->'entrega', '{}'::jsonb),
    'pagamento', COALESCE(p_pedido.itens->'pagamento', '{}'::jsonb),
    'observacoes', p_pedido.itens->>'observacoes',
    'subtotal', COALESCE((p_pedido.itens->>'subtotal')::numeric, p_pedido.valor_total),
    'whatsapp_declarado_enviado_em', p_pedido.whatsapp_declarado_enviado_em
  )
$$;

-- 7) criar_pedido — reescrita completa
DROP FUNCTION IF EXISTS public.criar_pedido(jsonb, jsonb, jsonb, jsonb, text, text, text);

CREATE FUNCTION public.criar_pedido(
  p_itens jsonb,
  p_cliente jsonb,
  p_entrega jsonb,
  p_pagamento jsonb,
  p_observacoes text DEFAULT NULL,
  p_canal text DEFAULT 'whatsapp',
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(id uuid, numero_pedido text, valor_total numeric, frete_status text, snapshot jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  v_saldo int;
  v_agg jsonb := '{}'::jsonb;
  v_chave text;
BEGIN
  -- 7.1 Idempotência obrigatória e validada
  PERFORM public.validar_checkout_key(p_idempotency_key);

  SELECT * INTO v_pedido FROM public.pedidos p WHERE p.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.valor_total,
                        v_pedido.frete_status, public.pedido_snapshot(v_pedido);
    RETURN;
  END IF;

  -- 7.2 Canal
  p_canal := COALESCE(NULLIF(p_canal,''), 'whatsapp');
  IF p_canal NOT IN ('whatsapp','site','loja') THEN
    RAISE EXCEPTION 'Canal não permitido.' USING ERRCODE = '22023';
  END IF;

  -- 7.3 Cliente
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

  -- 7.4 Entrega
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

  -- 7.5 Pagamento
  v_metodo_pagto := COALESCE(p_pagamento->>'metodo','');
  IF v_metodo_pagto NOT IN ('pix','debito','credito','dinheiro') THEN
    RAISE EXCEPTION 'Forma de pagamento não permitida.' USING ERRCODE = '22023';
  END IF;
  v_parcelas := COALESCE((p_pagamento->>'parcelas')::int, 1);
  IF v_metodo_pagto <> 'credito' THEN
    v_parcelas := 1;
  END IF;
  IF v_parcelas < 1 OR v_parcelas > 12 THEN
    RAISE EXCEPTION 'Número de parcelas não permitido.' USING ERRCODE = '22023';
  END IF;

  -- 7.6 Itens: agrega por slug+tamanho (ignora name/image/price do cliente)
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

    SELECT pr.id, pr.slug, pr.nome, pr.preco,
           COALESCE(pr.imagens->>0, '') AS imagem
      INTO v_prod
      FROM public.produtos pr
     WHERE pr.slug = v_slug AND pr.ativo = TRUE AND pr.arquivado_em IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto indisponível: %', v_slug USING ERRCODE = '22023';
    END IF;

    SELECT pv.quantidade INTO v_saldo
      FROM public.produto_variacoes pv
     WHERE pv.produto_id = v_prod.id AND pv.tamanho = v_size;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tamanho % indisponível para %.', v_size, v_slug USING ERRCODE = '22023';
    END IF;
    IF v_saldo < v_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para % tam % (disponível %).', v_slug, v_size, v_saldo
        USING ERRCODE = '22023';
    END IF;

    v_subtotal := v_subtotal + (v_prod.preco * v_qty);
    v_itens_oficiais := v_itens_oficiais || jsonb_build_array(jsonb_build_object(
      'slug', v_prod.slug,
      'name', v_prod.nome,
      'size', v_size,
      'quantity', v_qty,
      'price', v_prod.preco,
      'image', v_prod.imagem
    ));
  END LOOP;

  IF v_total_qty > 50 THEN
    RAISE EXCEPTION 'Quantidade total do pedido excede 50 peças.' USING ERRCODE = '22023';
  END IF;
  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Valor total inválido.' USING ERRCODE = '22023';
  END IF;

  -- 7.7 Insere com tratamento de corrida na chave de idempotência
  BEGIN
    INSERT INTO public.pedidos (itens, valor_total, status, canal, idempotency_key, frete_status)
    VALUES (
      jsonb_build_object(
        'produtos', v_itens_oficiais,
        'cliente', jsonb_build_object(
          'nome', btrim(p_cliente->>'nome'),
          'telefone', v_tel,
          'cpf', NULLIF(v_cpf,''),
          'cidade', p_cliente->>'cidade'
        ),
        'entrega', jsonb_build_object(
          'metodo', v_metodo_entrega,
          'endereco', v_end,
          'retirada', v_ret,
          'frete', jsonb_build_object('status','pendente','label','A combinar','cost', NULL)
        ),
        'pagamento', jsonb_build_object('metodo', v_metodo_pagto, 'parcelas', v_parcelas),
        'observacoes', NULLIF(btrim(COALESCE(p_observacoes,'')),''),
        'subtotal', v_subtotal,
        'frete', 0
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

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pedido.criado', 'cliente',
          jsonb_build_object('canal', p_canal, 'itens', jsonb_array_length(v_itens_oficiais)));

  RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.valor_total,
                      v_pedido.frete_status, public.pedido_snapshot(v_pedido);
END $$;

REVOKE ALL ON FUNCTION public.criar_pedido(jsonb,jsonb,jsonb,jsonb,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_pedido(jsonb,jsonb,jsonb,jsonb,text,text,text)
  TO anon, authenticated, service_role;

-- 8) confirmar_whatsapp_checkout — idempotente, autenticada pela chave do checkout
CREATE OR REPLACE FUNCTION public.confirmar_whatsapp_checkout(
  p_pedido_id uuid,
  p_idempotency_key text
)
RETURNS TABLE(id uuid, numero_pedido text, status text,
              whatsapp_declarado_enviado_em timestamptz, snapshot jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
BEGIN
  PERFORM public.validar_checkout_key(p_idempotency_key);
  IF p_pedido_id IS NULL THEN
    RAISE EXCEPTION 'Pedido inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos p
   WHERE p.id = p_pedido_id AND p.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotente: já declarado devolve o mesmo estado sem novo evento.
  IF v_pedido.whatsapp_declarado_enviado_em IS NOT NULL THEN
    RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.status,
                        v_pedido.whatsapp_declarado_enviado_em,
                        public.pedido_snapshot(v_pedido);
    RETURN;
  END IF;

  IF v_pedido.status = 'cancelado' THEN
    RAISE EXCEPTION 'Este pedido foi cancelado.' USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET whatsapp_declarado_enviado_em = now(),
         whatsapp_confirmacao_origem = 'cliente'
   WHERE pedidos.id = v_pedido.id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'whatsapp.declarado_enviado', 'cliente',
          jsonb_build_object('declarado_em', v_pedido.whatsapp_declarado_enviado_em));

  RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.status,
                      v_pedido.whatsapp_declarado_enviado_em,
                      public.pedido_snapshot(v_pedido);
END $$;

REVOKE ALL ON FUNCTION public.confirmar_whatsapp_checkout(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_whatsapp_checkout(uuid,text)
  TO anon, authenticated, service_role;

-- 9) cancelar_pedido_checkout — só em 'novo', janela de 2h, idempotente
CREATE OR REPLACE FUNCTION public.cancelar_pedido_checkout(
  p_pedido_id uuid,
  p_idempotency_key text
)
RETURNS TABLE(id uuid, numero_pedido text, status text, valor_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_janela interval := interval '2 hours';
BEGIN
  PERFORM public.validar_checkout_key(p_idempotency_key);
  IF p_pedido_id IS NULL THEN
    RAISE EXCEPTION 'Pedido inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos p
   WHERE p.id = p_pedido_id AND p.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada para cancelamento.' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotente
  IF v_pedido.status = 'cancelado' THEN
    RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.status, v_pedido.valor_total;
    RETURN;
  END IF;

  -- Cliente só cancela enquanto ninguém assumiu o atendimento.
  IF v_pedido.status <> 'novo'
     OR v_pedido.consumo_aplicado
     OR v_pedido.responsavel_id IS NOT NULL
     OR v_pedido.atendente_nome IS NOT NULL THEN
    RAISE EXCEPTION 'O atendimento deste pedido já começou. Solicite o cancelamento à equipe.'
      USING ERRCODE = '23514';
  END IF;

  IF now() - v_pedido.criado_em > v_janela THEN
    RAISE EXCEPTION 'O prazo de cancelamento automático expirou. Solicite o cancelamento à equipe.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET status = 'cancelado', atualizado_em = now()
   WHERE pedidos.id = v_pedido.id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pedido.cancelado', 'cliente', '{}'::jsonb);

  RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.status, v_pedido.valor_total;
END $$;

REVOKE ALL ON FUNCTION public.cancelar_pedido_checkout(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido_checkout(uuid,text)
  TO anon, authenticated, service_role;

-- 10) transicionar_pedido — responsável canônico via auth.uid()
DROP FUNCTION IF EXISTS public.transicionar_pedido(uuid, text, text);

CREATE FUNCTION public.transicionar_pedido(
  p_pedido_id uuid,
  p_novo_status text
)
RETURNS public.pedidos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_nome text;
  v_item jsonb;
  v_qty int;
  v_size text;
  v_slug text;
  v_current int;
  v_produto_id uuid;
  v_consumir boolean := false;
  v_estornar boolean := false;
BEGIN
  IF v_uid IS NULL OR NOT (
    public.has_role(v_uid,'admin') OR public.has_role(v_uid,'atendente')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para transicionar pedidos.' USING ERRCODE = '42501';
  END IF;

  -- Nome resolvido pelo perfil — nunca confiado ao frontend.
  SELECT COALESCE(NULLIF(btrim(pf.nome), ''), pf.email)
    INTO v_nome FROM public.profiles pf WHERE pf.id = v_uid;

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pedido.status = p_novo_status THEN
    RETURN v_pedido;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pedido_transicoes
     WHERE de = v_pedido.status AND para = p_novo_status
  ) THEN
    RAISE EXCEPTION 'Transição inválida: % → %.', v_pedido.status, p_novo_status
      USING ERRCODE = '23514';
  END IF;

  IF p_novo_status IN ('separado','reservado') AND NOT v_pedido.consumo_aplicado THEN
    v_consumir := true;
  ELSIF p_novo_status = 'cancelado' AND v_pedido.consumo_aplicado THEN
    v_estornar := true;
  END IF;

  IF v_consumir OR v_estornar THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_pedido.itens->'produtos') LOOP
      v_slug := v_item->>'slug';
      v_size := v_item->>'size';
      v_qty  := COALESCE((v_item->>'quantity')::int, 0);
      IF v_slug IS NULL OR v_size IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

      SELECT produtos.id INTO v_produto_id FROM public.produtos WHERE produtos.slug = v_slug;
      IF v_produto_id IS NULL THEN
        RAISE EXCEPTION 'Produto do pedido não localizado (%).', v_slug;
      END IF;

      SELECT quantidade INTO v_current
        FROM public.produto_variacoes
       WHERE produto_id = v_produto_id AND tamanho = v_size
       FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variação % / % ausente.', v_slug, v_size;
      END IF;

      IF v_consumir THEN
        IF v_current < v_qty THEN
          RAISE EXCEPTION 'Estoque insuficiente para % tam % (atual %, precisa %).',
            v_slug, v_size, v_current, v_qty;
        END IF;
        UPDATE public.produto_variacoes SET quantidade = quantidade - v_qty
         WHERE produto_id = v_produto_id AND tamanho = v_size;
        INSERT INTO public.produto_movimentacoes
          (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id)
        VALUES (v_produto_id, v_size, 'consumo_pedido', -v_qty, v_uid,
                format('Pedido %s', v_pedido.numero_pedido), v_pedido.id);
      ELSE
        UPDATE public.produto_variacoes SET quantidade = quantidade + v_qty
         WHERE produto_id = v_produto_id AND tamanho = v_size;
        INSERT INTO public.produto_movimentacoes
          (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id)
        VALUES (v_produto_id, v_size, 'entrada', v_qty, v_uid,
                format('Estorno do pedido %s', v_pedido.numero_pedido), v_pedido.id);
      END IF;
    END LOOP;
  END IF;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET status = p_novo_status,
         atualizado_em = now(),
         responsavel_id = COALESCE(pedidos.responsavel_id, v_uid),
         atendente_nome = COALESCE(pedidos.atendente_nome, v_nome),
         consumo_aplicado = CASE
           WHEN v_consumir THEN true
           WHEN v_estornar THEN false
           ELSE pedidos.consumo_aplicado
         END
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pedido.status', 'equipe', v_uid,
          jsonb_build_object('para', p_novo_status));

  RETURN v_pedido;
END $$;

REVOKE ALL ON FUNCTION public.transicionar_pedido(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transicionar_pedido(uuid,text) TO authenticated, service_role;