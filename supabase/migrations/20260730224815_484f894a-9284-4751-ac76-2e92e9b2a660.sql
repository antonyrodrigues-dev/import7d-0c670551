-- =====================================================================
-- ONDA 0 — Bloqueadores e regras operacionais
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Parâmetros operacionais (fonte única de configuração de negócio)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parametros_operacionais (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  descricao text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

GRANT SELECT ON public.parametros_operacionais TO authenticated;
GRANT ALL ON public.parametros_operacionais TO service_role;
ALTER TABLE public.parametros_operacionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe le parametros" ON public.parametros_operacionais;
CREATE POLICY "Equipe le parametros" ON public.parametros_operacionais
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));

INSERT INTO public.parametros_operacionais (chave, valor, descricao)
VALUES ('reserva_peca_unica_minutos', to_jsonb(20), 'Duração da reserva temporária de peça única, em minutos.')
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.definir_parametro(p_chave text, p_valor jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master altera parâmetros.' USING ERRCODE = '42501';
  END IF;
  IF p_chave = 'reserva_peca_unica_minutos'
     AND (jsonb_typeof(p_valor) <> 'number' OR (p_valor)::int < 5 OR (p_valor)::int > 1440) THEN
    RAISE EXCEPTION 'Duração de reserva deve ficar entre 5 e 1440 minutos.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.parametros_operacionais (chave, valor, atualizado_em, atualizado_por)
  VALUES (p_chave, p_valor, now(), auth.uid())
  ON CONFLICT (chave) DO UPDATE
    SET valor = EXCLUDED.valor, atualizado_em = now(), atualizado_por = auth.uid();
END $$;

REVOKE ALL ON FUNCTION public.definir_parametro(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_parametro(text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. Produtos / variações: modelo de estoque, reserva e quarentena
-- ---------------------------------------------------------------------
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS modelo_estoque text NOT NULL DEFAULT 'multi_variante';
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_modelo_estoque_check;
ALTER TABLE public.produtos ADD CONSTRAINT produtos_modelo_estoque_check
  CHECK (modelo_estoque IN ('peca_unica','multi_variante','kit'));

ALTER TABLE public.produto_variacoes
  ADD COLUMN IF NOT EXISTS quantidade_reservada int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_quarentena int NOT NULL DEFAULT 0;
ALTER TABLE public.produto_variacoes DROP CONSTRAINT IF EXISTS produto_variacoes_reservada_check;
ALTER TABLE public.produto_variacoes ADD CONSTRAINT produto_variacoes_reservada_check
  CHECK (quantidade_reservada >= 0 AND quantidade_reservada <= quantidade);
ALTER TABLE public.produto_variacoes DROP CONSTRAINT IF EXISTS produto_variacoes_quarentena_check;
ALTER TABLE public.produto_variacoes ADD CONSTRAINT produto_variacoes_quarentena_check
  CHECK (quantidade_quarentena >= 0);
ALTER TABLE public.produto_variacoes
  ADD COLUMN IF NOT EXISTS disponivel int
  GENERATED ALWAYS AS (quantidade - quantidade_reservada) STORED;

-- Movimentações: tipos ampliados + saldo auditável
ALTER TABLE public.produto_movimentacoes
  ADD COLUMN IF NOT EXISTS saldo_anterior int,
  ADD COLUMN IF NOT EXISTS saldo_posterior int,
  ADD COLUMN IF NOT EXISTS motivo text;
ALTER TABLE public.produto_movimentacoes DROP CONSTRAINT IF EXISTS produto_movimentacoes_tipo_check;
ALTER TABLE public.produto_movimentacoes ADD CONSTRAINT produto_movimentacoes_tipo_check
  CHECK (tipo IN ('entrada','saida','ajuste','reposicao','consumo_pedido',
                  'reserva','liberacao_reserva','venda','cancelamento',
                  'devolucao','correcao_inventario','perda','avaria'));

-- ---------------------------------------------------------------------
-- 3. Reservas de estoque
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservas_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  tamanho text NOT NULL,
  quantidade int NOT NULL CHECK (quantidade > 0),
  estado text NOT NULL DEFAULT 'reservada_temporariamente',
  expira_em timestamptz NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservas_estoque_estado_check CHECK (
    estado IN ('reservada_temporariamente','em_atendimento','vendida','expirada','cancelada')
  )
);

CREATE INDEX IF NOT EXISTS reservas_estoque_ativas_idx
  ON public.reservas_estoque (produto_id, tamanho)
  WHERE estado IN ('reservada_temporariamente','em_atendimento');
CREATE INDEX IF NOT EXISTS reservas_estoque_pedido_idx ON public.reservas_estoque (pedido_id);
CREATE INDEX IF NOT EXISTS reservas_estoque_expira_idx ON public.reservas_estoque (expira_em)
  WHERE estado = 'reservada_temporariamente';

GRANT SELECT ON public.reservas_estoque TO authenticated;
GRANT ALL ON public.reservas_estoque TO service_role;
ALTER TABLE public.reservas_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe le reservas" ON public.reservas_estoque;
CREATE POLICY "Equipe le reservas" ON public.reservas_estoque
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));

-- ---------------------------------------------------------------------
-- 4. Pedidos: novos estados, fila e pagamento
-- ---------------------------------------------------------------------
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS atribuido_em timestamptz,
  ADD COLUMN IF NOT EXISTS pagamento_estado text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS valor_devolvido numeric NOT NULL DEFAULT 0;

ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_pagamento_estado_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_pagamento_estado_check
  CHECK (pagamento_estado IN ('pendente','aguardando_comprovante','em_analise','confirmado','recusado','estornado'));

ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_status_check CHECK (status IN (
  'novo','whatsapp_declarado','aguardando_atendimento','em_atendimento','aguardando_pagamento',
  'pagamento_confirmado','separado','reservado','aguardando_retirada','enviado',
  'finalizado','cancelado','devolvido'
));

-- Histórico legado: pedidos já finalizados contam como pagamento confirmado.
UPDATE public.pedidos SET pagamento_estado = 'confirmado'
 WHERE status = 'finalizado' AND pagamento_estado = 'pendente';

-- Máquina de estados oficial
INSERT INTO public.pedido_transicoes (de, para) VALUES
  ('novo','whatsapp_declarado'),
  ('novo','aguardando_atendimento'),
  ('novo','em_atendimento'),
  ('whatsapp_declarado','aguardando_atendimento'),
  ('whatsapp_declarado','em_atendimento'),
  ('whatsapp_declarado','cancelado'),
  ('aguardando_atendimento','em_atendimento'),
  ('aguardando_atendimento','cancelado'),
  ('em_atendimento','aguardando_pagamento'),
  ('em_atendimento','pagamento_confirmado'),
  ('em_atendimento','separado'),
  ('em_atendimento','reservado'),
  ('em_atendimento','aguardando_atendimento'),
  ('em_atendimento','cancelado'),
  ('aguardando_pagamento','pagamento_confirmado'),
  ('aguardando_pagamento','cancelado'),
  ('finalizado','devolvido')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. Atendimentos, pagamentos e devoluções
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedido_atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  responsavel_id uuid,
  responsavel_nome text,
  acao text NOT NULL CHECK (acao IN ('assumido','transferido','devolvido_fila')),
  por_usuario uuid,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedido_atendimentos_pedido_idx ON public.pedido_atendimentos (pedido_id);
GRANT SELECT ON public.pedido_atendimentos TO authenticated;
GRANT ALL ON public.pedido_atendimentos TO service_role;
ALTER TABLE public.pedido_atendimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe le atendimentos" ON public.pedido_atendimentos;
CREATE POLICY "Equipe le atendimentos" ON public.pedido_atendimentos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));

CREATE TABLE IF NOT EXISTS public.pedido_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  estado text NOT NULL CHECK (estado IN ('pendente','aguardando_comprovante','em_analise','confirmado','recusado','estornado')),
  metodo text,
  valor numeric NOT NULL DEFAULT 0,
  parcelas int NOT NULL DEFAULT 1,
  comprovante_url text,
  observacao text,
  por_usuario uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedido_pagamentos_pedido_idx ON public.pedido_pagamentos (pedido_id);
GRANT SELECT ON public.pedido_pagamentos TO authenticated;
GRANT ALL ON public.pedido_pagamentos TO service_role;
ALTER TABLE public.pedido_pagamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe le pagamentos" ON public.pedido_pagamentos;
CREATE POLICY "Equipe le pagamentos" ON public.pedido_pagamentos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));

CREATE TABLE IF NOT EXISTS public.pedido_devolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  motivo text NOT NULL,
  valor_estornado numeric NOT NULL DEFAULT 0 CHECK (valor_estornado >= 0),
  observacoes text,
  evidencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  aprovado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedido_devolucoes_pedido_idx ON public.pedido_devolucoes (pedido_id);
GRANT SELECT ON public.pedido_devolucoes TO authenticated;
GRANT ALL ON public.pedido_devolucoes TO service_role;
ALTER TABLE public.pedido_devolucoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe le devolucoes" ON public.pedido_devolucoes;
CREATE POLICY "Equipe le devolucoes" ON public.pedido_devolucoes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));

CREATE TABLE IF NOT EXISTS public.pedido_devolucao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucao_id uuid NOT NULL REFERENCES public.pedido_devolucoes(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  slug text NOT NULL,
  tamanho text NOT NULL,
  quantidade int NOT NULL CHECK (quantidade > 0),
  condicao text NOT NULL CHECK (condicao IN ('vendavel','usada','avariada','defeituosa')),
  retornou_estoque boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedido_devolucao_itens_dev_idx ON public.pedido_devolucao_itens (devolucao_id);
GRANT SELECT ON public.pedido_devolucao_itens TO authenticated;
GRANT ALL ON public.pedido_devolucao_itens TO service_role;
ALTER TABLE public.pedido_devolucao_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe le itens devolvidos" ON public.pedido_devolucao_itens;
CREATE POLICY "Equipe le itens devolvidos" ON public.pedido_devolucao_itens
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));

-- Histórico imutável: nenhuma aplicação altera/remove trilhas
REVOKE INSERT, UPDATE, DELETE ON public.pedido_atendimentos FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.pedido_pagamentos FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.pedido_devolucoes FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.pedido_devolucao_itens FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.reservas_estoque FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.parametros_operacionais FROM authenticated, anon;

-- ---------------------------------------------------------------------
-- 6. Guarda de UPDATE em pedidos (novos campos operacionais)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pedidos_guard_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_rpc boolean := COALESCE(current_setting('app.rpc_ctx', true), '') = 'on';
BEGIN
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

  IF NOT v_rpc THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.consumo_aplicado IS DISTINCT FROM OLD.consumo_aplicado
       OR NEW.atendente_nome IS DISTINCT FROM OLD.atendente_nome
       OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
       OR NEW.atribuido_em IS DISTINCT FROM OLD.atribuido_em
       OR NEW.pagamento_estado IS DISTINCT FROM OLD.pagamento_estado
       OR NEW.valor_devolvido IS DISTINCT FROM OLD.valor_devolvido
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
      SELECT 1 FROM public.pedido_transicoes WHERE de = OLD.status AND para = NEW.status
    ) THEN
      RAISE EXCEPTION 'Transição de status inválida: % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- 7. Reserva temporária: helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserva_minutos()
RETURNS int LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT (valor)::int FROM public.parametros_operacionais
                    WHERE chave = 'reserva_peca_unica_minutos'), 20)
$$;

-- Libera reservas vencidas (idempotente; segura para chamada repetida)
CREATE OR REPLACE FUNCTION public.expirar_reservas()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  r record;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.reservas_estoque
     WHERE estado = 'reservada_temporariamente' AND expira_em < now()
     ORDER BY id
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.produto_variacoes
       SET quantidade_reservada = GREATEST(0, quantidade_reservada - r.quantidade),
           atualizado_em = now()
     WHERE produto_id = r.produto_id AND tamanho = r.tamanho;

    UPDATE public.reservas_estoque
       SET estado = 'expirada', atualizado_em = now()
     WHERE id = r.id;

    INSERT INTO public.produto_movimentacoes
      (produto_id, tamanho, tipo, quantidade, motivo, observacao, pedido_id)
    VALUES (r.produto_id, r.tamanho, 'liberacao_reserva', r.quantidade,
            'expiracao', 'Reserva temporária expirada', r.pedido_id);

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.expirar_reservas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expirar_reservas() TO anon, authenticated;

-- Libera todas as reservas ativas de um pedido (cancelamento)
CREATE OR REPLACE FUNCTION public.liberar_reservas_pedido(p_pedido_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM public.reservas_estoque
     WHERE pedido_id = p_pedido_id
       AND estado IN ('reservada_temporariamente','em_atendimento')
     FOR UPDATE
  LOOP
    UPDATE public.produto_variacoes
       SET quantidade_reservada = GREATEST(0, quantidade_reservada - r.quantidade),
           atualizado_em = now()
     WHERE produto_id = r.produto_id AND tamanho = r.tamanho;
    UPDATE public.reservas_estoque
       SET estado = 'cancelada', atualizado_em = now()
     WHERE id = r.id;
    INSERT INTO public.produto_movimentacoes
      (produto_id, tamanho, tipo, quantidade, motivo, observacao, pedido_id)
    VALUES (r.produto_id, r.tamanho, 'liberacao_reserva', r.quantidade,
            COALESCE(p_motivo,'cancelamento'), 'Reserva liberada', p_pedido_id);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.liberar_reservas_pedido(uuid, text) FROM PUBLIC, anon, authenticated;

-- Converte reservas em venda (consumo definitivo já aplicado no saldo)
CREATE OR REPLACE FUNCTION public.converter_reservas_pedido(p_pedido_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM public.reservas_estoque
     WHERE pedido_id = p_pedido_id
       AND estado IN ('reservada_temporariamente','em_atendimento')
     FOR UPDATE
  LOOP
    UPDATE public.produto_variacoes
       SET quantidade_reservada = GREATEST(0, quantidade_reservada - r.quantidade),
           atualizado_em = now()
     WHERE produto_id = r.produto_id AND tamanho = r.tamanho;
    UPDATE public.reservas_estoque
       SET estado = 'vendida', atualizado_em = now()
     WHERE id = r.id;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.converter_reservas_pedido(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. criar_pedido — valida disponível e reserva peça única
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_pedido(p_itens jsonb, p_cliente jsonb, p_entrega jsonb, p_pagamento jsonb, p_observacoes text DEFAULT NULL::text, p_canal text DEFAULT 'whatsapp'::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, numero_pedido text, valor_total numeric, frete_status text, snapshot jsonb)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  v_saldo int;
  v_agg jsonb := '{}'::jsonb;
  v_chave text;
  v_reservas jsonb := '[]'::jsonb;
  v_res jsonb;
  v_expira timestamptz;
BEGIN
  PERFORM public.validar_checkout_key(p_idempotency_key);
  PERFORM public.expirar_reservas();

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
           COALESCE(pr.imagens->>0, '') AS imagem
      INTO v_prod
      FROM public.produtos pr
     WHERE pr.slug = v_slug AND pr.ativo = TRUE AND pr.arquivado_em IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto indisponível: %', v_slug USING ERRCODE = '22023';
    END IF;

    -- Trava a variação: impede duas reservas simultâneas da mesma unidade.
    SELECT pv.quantidade - pv.quantidade_reservada INTO v_saldo
      FROM public.produto_variacoes pv
     WHERE pv.produto_id = v_prod.id AND pv.tamanho = v_size
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tamanho % indisponível para %.', v_size, v_slug USING ERRCODE = '22023';
    END IF;
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

  -- Reserva temporária atômica das peças únicas
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

-- ---------------------------------------------------------------------
-- 9. Confirmação de WhatsApp e cancelamento pelo cliente
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirmar_whatsapp_checkout(p_pedido_id uuid, p_idempotency_key text)
 RETURNS TABLE(id uuid, numero_pedido text, status text, whatsapp_declarado_enviado_em timestamptz, snapshot jsonb)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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

  IF v_pedido.whatsapp_declarado_enviado_em IS NOT NULL THEN
    RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.status,
                        v_pedido.whatsapp_declarado_enviado_em, public.pedido_snapshot(v_pedido);
    RETURN;
  END IF;

  IF v_pedido.status = 'cancelado' THEN
    RAISE EXCEPTION 'Este pedido foi cancelado.' USING ERRCODE = '23514';
  END IF;

  -- Declaração do cliente estende a reserva: a peça não pode expirar
  -- enquanto a loja ainda não abriu o atendimento.
  UPDATE public.reservas_estoque
     SET expira_em = GREATEST(expira_em, now() + make_interval(mins => public.reserva_minutos())),
         atualizado_em = now()
   WHERE pedido_id = v_pedido.id AND estado = 'reservada_temporariamente';

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET whatsapp_declarado_enviado_em = now(),
         whatsapp_confirmacao_origem = 'cliente',
         status = CASE WHEN pedidos.status = 'novo' THEN 'whatsapp_declarado' ELSE pedidos.status END,
         atualizado_em = now()
   WHERE pedidos.id = v_pedido.id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'whatsapp.declarado_enviado', 'cliente',
          jsonb_build_object('declarado_em', v_pedido.whatsapp_declarado_enviado_em));

  RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.status,
                      v_pedido.whatsapp_declarado_enviado_em, public.pedido_snapshot(v_pedido);
END $function$;

CREATE OR REPLACE FUNCTION public.cancelar_pedido_checkout(p_pedido_id uuid, p_idempotency_key text)
 RETURNS TABLE(id uuid, numero_pedido text, status text, valor_total numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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

  IF v_pedido.status = 'cancelado' THEN
    RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.status, v_pedido.valor_total;
    RETURN;
  END IF;

  -- Cliente só cancela sozinho antes do atendimento começar.
  IF v_pedido.status NOT IN ('novo','whatsapp_declarado','aguardando_atendimento')
     OR v_pedido.consumo_aplicado
     OR v_pedido.pagamento_estado = 'confirmado'
     OR v_pedido.responsavel_id IS NOT NULL
     OR v_pedido.atendente_nome IS NOT NULL THEN
    RAISE EXCEPTION 'O atendimento deste pedido já começou. Solicite o cancelamento à equipe.'
      USING ERRCODE = '23514';
  END IF;

  IF now() - v_pedido.criado_em > v_janela THEN
    RAISE EXCEPTION 'O prazo de cancelamento automático expirou. Solicite o cancelamento à equipe.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM public.liberar_reservas_pedido(v_pedido.id, 'cancelamento_cliente');

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET status = 'cancelado', atualizado_em = now()
   WHERE pedidos.id = v_pedido.id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pedido.cancelado', 'cliente', '{}'::jsonb);

  RETURN QUERY SELECT v_pedido.id, v_pedido.numero_pedido, v_pedido.status, v_pedido.valor_total;
END $function$;

-- ---------------------------------------------------------------------
-- 10. Fila de atendimento
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assumir_atendimento(p_pedido_id uuid)
RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_nome text;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'atendente')) THEN
    RAISE EXCEPTION 'Sem permissão para assumir atendimentos.' USING ERRCODE = '42501';
  END IF;

  SELECT NULLIF(btrim(pf.nome),'') INTO v_nome FROM public.profiles pf WHERE pf.user_id = v_uid;
  v_nome := COALESCE(v_nome, 'Equipe 7D');

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pedido.responsavel_id IS NOT NULL THEN
    IF v_pedido.responsavel_id = v_uid THEN
      RETURN v_pedido; -- idempotente
    END IF;
    RAISE EXCEPTION 'Este pedido já está em atendimento com outro responsável.'
      USING ERRCODE = '23505';
  END IF;

  IF v_pedido.status NOT IN ('novo','whatsapp_declarado','aguardando_atendimento') THEN
    RAISE EXCEPTION 'Pedido não está na fila de atendimento.' USING ERRCODE = '23514';
  END IF;

  -- Reserva passa a acompanhar o atendimento (não expira sozinha).
  UPDATE public.reservas_estoque
     SET estado = 'em_atendimento', atualizado_em = now()
   WHERE pedido_id = v_pedido.id AND estado = 'reservada_temporariamente';

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET responsavel_id = v_uid, atendente_nome = v_nome, atribuido_em = now(),
         status = 'em_atendimento', atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_atendimentos (pedido_id, responsavel_id, responsavel_nome, acao, por_usuario)
  VALUES (v_pedido.id, v_uid, v_nome, 'assumido', v_uid);
  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'atendimento.assumido', 'equipe', v_uid,
          jsonb_build_object('responsavel', v_nome));

  RETURN v_pedido;
END $$;
REVOKE ALL ON FUNCTION public.assumir_atendimento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assumir_atendimento(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.transferir_atendimento(p_pedido_id uuid, p_novo_responsavel uuid, p_observacao text DEFAULT NULL)
RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_nome text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master transfere atendimentos.' USING ERRCODE = '42501';
  END IF;
  IF p_novo_responsavel IS NULL THEN
    RAISE EXCEPTION 'Responsável de destino obrigatório.' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role(p_novo_responsavel,'admin') OR public.has_role(p_novo_responsavel,'atendente')) THEN
    RAISE EXCEPTION 'Destino não pertence à equipe.' USING ERRCODE = '42501';
  END IF;

  SELECT NULLIF(btrim(pf.nome),'') INTO v_nome FROM public.profiles pf WHERE pf.user_id = p_novo_responsavel;
  v_nome := COALESCE(v_nome, 'Equipe 7D');

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET responsavel_id = p_novo_responsavel, atendente_nome = v_nome,
         atribuido_em = now(), atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_atendimentos (pedido_id, responsavel_id, responsavel_nome, acao, por_usuario, observacao)
  VALUES (v_pedido.id, p_novo_responsavel, v_nome, 'transferido', v_uid, p_observacao);
  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'atendimento.transferido', 'equipe', v_uid,
          jsonb_build_object('para', v_nome));

  RETURN v_pedido;
END $$;
REVOKE ALL ON FUNCTION public.transferir_atendimento(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transferir_atendimento(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.devolver_para_fila(p_pedido_id uuid, p_observacao text DEFAULT NULL)
RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master devolve pedidos à fila.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.status NOT IN ('em_atendimento','aguardando_atendimento') THEN
    RAISE EXCEPTION 'Só é possível devolver à fila um pedido em atendimento.' USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET responsavel_id = NULL, atendente_nome = NULL, atribuido_em = NULL,
         status = 'aguardando_atendimento', atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_atendimentos (pedido_id, acao, por_usuario, observacao)
  VALUES (v_pedido.id, 'devolvido_fila', v_uid, p_observacao);
  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'atendimento.devolvido_fila', 'equipe', v_uid, '{}'::jsonb);

  RETURN v_pedido;
END $$;
REVOKE ALL ON FUNCTION public.devolver_para_fila(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.devolver_para_fila(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 11. transicionar_pedido — reservas + devolução + guarda de responsável
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transicionar_pedido(p_pedido_id uuid, p_novo_status text)
 RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_nome text;
  v_item jsonb;
  v_qty int;
  v_size text;
  v_slug text;
  v_current int;
  v_reservado int;
  v_produto_id uuid;
  v_consumir boolean := false;
  v_estornar boolean := false;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'atendente')) THEN
    RAISE EXCEPTION 'Sem permissão para transicionar pedidos.' USING ERRCODE = '42501';
  END IF;
  v_admin := public.has_role(v_uid,'admin');

  SELECT NULLIF(btrim(pf.nome), '') INTO v_nome FROM public.profiles pf WHERE pf.user_id = v_uid;
  v_nome := COALESCE(v_nome, 'Equipe 7D');

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  -- Vendedor não mexe em pedido de outro vendedor.
  IF NOT v_admin AND v_pedido.responsavel_id IS NOT NULL AND v_pedido.responsavel_id <> v_uid THEN
    RAISE EXCEPTION 'Este pedido pertence a outro atendente.' USING ERRCODE = '42501';
  END IF;

  IF v_pedido.status = p_novo_status THEN
    RETURN v_pedido;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pedido_transicoes WHERE de = v_pedido.status AND para = p_novo_status
  ) THEN
    RAISE EXCEPTION 'Transição inválida: % → %.', v_pedido.status, p_novo_status
      USING ERRCODE = '23514';
  END IF;

  IF p_novo_status = 'pagamento_confirmado' AND NOT v_admin THEN
    RAISE EXCEPTION 'Somente o Admin Master confirma pagamento.' USING ERRCODE = '42501';
  END IF;
  IF p_novo_status = 'cancelado' AND v_pedido.pagamento_estado = 'confirmado' AND NOT v_admin THEN
    RAISE EXCEPTION 'Cancelar pedido pago exige aprovação do Admin Master.' USING ERRCODE = '42501';
  END IF;
  IF p_novo_status = 'devolvido' THEN
    RAISE EXCEPTION 'Use o fluxo de devolução para registrar a devolução.' USING ERRCODE = '23514';
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

      SELECT quantidade, quantidade_reservada INTO v_current, v_reservado
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
          (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id,
           saldo_anterior, saldo_posterior, motivo)
        VALUES (v_produto_id, v_size, 'consumo_pedido', -v_qty, v_uid,
                format('Pedido %s', v_pedido.numero_pedido), v_pedido.id,
                v_current, v_current - v_qty, 'venda');
      ELSE
        UPDATE public.produto_variacoes SET quantidade = quantidade + v_qty
         WHERE produto_id = v_produto_id AND tamanho = v_size;
        INSERT INTO public.produto_movimentacoes
          (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id,
           saldo_anterior, saldo_posterior, motivo)
        VALUES (v_produto_id, v_size, 'entrada', v_qty, v_uid,
                format('Estorno do pedido %s', v_pedido.numero_pedido), v_pedido.id,
                v_current, v_current + v_qty, 'cancelamento');
      END IF;
    END LOOP;
  END IF;

  -- Reservas: consumo converte em venda; cancelamento libera.
  IF v_consumir THEN
    PERFORM public.converter_reservas_pedido(v_pedido.id);
  ELSIF p_novo_status = 'cancelado' THEN
    PERFORM public.liberar_reservas_pedido(v_pedido.id, 'cancelamento_equipe');
  END IF;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET status = p_novo_status,
         atualizado_em = now(),
         responsavel_id = COALESCE(pedidos.responsavel_id, v_uid),
         atendente_nome = COALESCE(pedidos.atendente_nome, v_nome),
         atribuido_em = COALESCE(pedidos.atribuido_em, now()),
         pagamento_estado = CASE
           WHEN p_novo_status = 'pagamento_confirmado' THEN 'confirmado'
           ELSE pedidos.pagamento_estado END,
         consumo_aplicado = CASE
           WHEN v_consumir THEN true
           WHEN v_estornar THEN false
           ELSE pedidos.consumo_aplicado END
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  IF p_novo_status = 'pagamento_confirmado' THEN
    INSERT INTO public.pedido_pagamentos (pedido_id, estado, valor, por_usuario, observacao)
    VALUES (v_pedido.id, 'confirmado', v_pedido.valor_total, v_uid, 'Confirmado na transição de status');
  END IF;

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pedido.status', 'equipe', v_uid,
          jsonb_build_object('para', p_novo_status));

  RETURN v_pedido;
END $function$;

-- ---------------------------------------------------------------------
-- 12. Pagamento
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_pagamento(
  p_pedido_id uuid, p_estado text, p_comprovante_url text DEFAULT NULL, p_observacao text DEFAULT NULL)
RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_admin boolean;
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

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET pagamento_estado = p_estado, atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_pagamentos
    (pedido_id, estado, valor, comprovante_url, observacao, por_usuario)
  VALUES (v_pedido.id, p_estado, v_pedido.valor_total, p_comprovante_url, p_observacao, v_uid);

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pagamento.estado', 'equipe', v_uid,
          jsonb_build_object('estado', p_estado));

  RETURN v_pedido;
END $$;
REVOKE ALL ON FUNCTION public.registrar_pagamento(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento(uuid, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 13. Devolução
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_devolucao(
  p_pedido_id uuid, p_itens jsonb, p_motivo text,
  p_valor_estornado numeric DEFAULT 0, p_observacoes text DEFAULT NULL,
  p_evidencias jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_dev_id uuid;
  v_item jsonb;
  v_slug text; v_size text; v_qty int; v_cond text;
  v_produto_id uuid; v_current int; v_quar int;
  v_vendido int;
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
  IF v_pedido.status <> 'finalizado' THEN
    RAISE EXCEPTION 'Somente pedidos finalizados podem ser devolvidos.' USING ERRCODE = '23514';
  END IF;
  IF p_valor_estornado < 0 OR (v_pedido.valor_devolvido + p_valor_estornado) > v_pedido.valor_total THEN
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
    IF v_cond NOT IN ('vendavel','usada','avariada','defeituosa') THEN
      RAISE EXCEPTION 'Condição da peça inválida.' USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(SUM((p->>'quantity')::int), 0) INTO v_vendido
      FROM jsonb_array_elements(v_pedido.itens->'produtos') p
     WHERE p->>'slug' = v_slug AND p->>'size' = v_size;
    IF v_vendido < v_qty THEN
      RAISE EXCEPTION 'Quantidade devolvida maior que a vendida (% tam %).', v_slug, v_size
        USING ERRCODE = '22023';
    END IF;

    SELECT produtos.id INTO v_produto_id FROM public.produtos WHERE produtos.slug = v_slug;
    IF v_produto_id IS NULL THEN
      RAISE EXCEPTION 'Produto da devolução não localizado (%).', v_slug USING ERRCODE = 'P0002';
    END IF;

    SELECT quantidade, quantidade_quarentena INTO v_current, v_quar
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
         SET quantidade_quarentena = quantidade_quarentena + v_qty, atualizado_em = now()
       WHERE produto_id = v_produto_id AND tamanho = v_size;
      INSERT INTO public.produto_movimentacoes
        (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id,
         saldo_anterior, saldo_posterior, motivo)
      VALUES (v_produto_id, v_size, 'avaria', v_qty, v_uid,
              format('Quarentena — devolução do pedido %s', v_pedido.numero_pedido), v_pedido.id,
              v_current, v_current, format('%s (%s)', btrim(p_motivo), v_cond));
    END IF;

    INSERT INTO public.pedido_devolucao_itens
      (devolucao_id, produto_id, slug, tamanho, quantidade, condicao, retornou_estoque)
    VALUES (v_dev_id, v_produto_id, v_slug, v_size, v_qty, v_cond, v_cond = 'vendavel');
  END LOOP;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET status = 'devolvido',
         valor_devolvido = pedidos.valor_devolvido + COALESCE(p_valor_estornado,0),
         pagamento_estado = CASE WHEN COALESCE(p_valor_estornado,0) > 0
                                 THEN 'estornado' ELSE pedidos.pagamento_estado END,
         atualizado_em = now()
   WHERE pedidos.id = p_pedido_id;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (p_pedido_id, v_pedido.numero_pedido, 'pedido.devolvido', 'equipe', v_uid,
          jsonb_build_object('devolucao_id', v_dev_id, 'valor_estornado', COALESCE(p_valor_estornado,0)));

  RETURN v_dev_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_devolucao(uuid, jsonb, text, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_devolucao(uuid, jsonb, text, numeric, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------
-- 14. Métricas financeiras — exclusivas do Admin Master
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.metricas_financeiras(p_periodo text DEFAULT '30d')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_desde timestamptz;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_res jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Acesso restrito ao Admin Master.' USING ERRCODE = '42501';
  END IF;

  v_desde := CASE p_periodo
    WHEN '7d'  THEN now() - interval '7 days'
    WHEN '30d' THEN now() - interval '30 days'
    WHEN '90d' THEN now() - interval '90 days'
    WHEN 'ano' THEN date_trunc('year', now())
    WHEN 'todos' THEN '-infinity'::timestamptz
    ELSE now() - interval '30 days'
  END;

  WITH base AS (
    SELECT p.*, (p.valor_total - p.valor_devolvido) AS receita_liquida
      FROM public.pedidos p
     WHERE p.status IN ('finalizado','devolvido')
       AND p.pagamento_estado = 'confirmado'
  ),
  periodo AS (SELECT * FROM base WHERE atualizado_em >= v_desde),
  cancelados AS (
    SELECT count(*) AS n FROM public.pedidos
     WHERE status = 'cancelado' AND atualizado_em >= v_desde
  ),
  serie AS (
    SELECT to_char((atualizado_em AT TIME ZONE 'America/Sao_Paulo')::date, 'DD/MM') AS label,
           (atualizado_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           sum(receita_liquida) AS receita, count(*) AS pedidos
      FROM periodo GROUP BY 1,2 ORDER BY 2
  ),
  itens AS (
    SELECT i->>'name' AS name, (i->>'quantity')::int AS qtd,
           (i->>'price')::numeric * (i->>'quantity')::int AS receita
      FROM periodo, jsonb_array_elements(itens->'produtos') i
  ),
  top_prod AS (
    SELECT name, sum(qtd) AS unidades, sum(receita) AS receita
      FROM itens GROUP BY name ORDER BY sum(receita) DESC LIMIT 5
  ),
  top_atend AS (
    SELECT COALESCE(atendente_nome,'Sem responsável') AS nome,
           sum(receita_liquida) AS receita, count(*) AS pedidos
      FROM periodo GROUP BY 1 ORDER BY sum(receita_liquida) DESC LIMIT 5
  ),
  pagto AS (
    SELECT COALESCE(itens->'pagamento'->>'metodo','—') AS metodo,
           sum(receita_liquida) AS receita, count(*) AS pedidos
      FROM periodo GROUP BY 1 ORDER BY sum(receita_liquida) DESC
  )
  SELECT jsonb_build_object(
    'periodo', p_periodo,
    'receitaDia', COALESCE((SELECT sum(receita_liquida) FROM base
        WHERE (atualizado_em AT TIME ZONE 'America/Sao_Paulo')::date = v_hoje), 0),
    'receitaMes', COALESCE((SELECT sum(receita_liquida) FROM base
        WHERE date_trunc('month', atualizado_em AT TIME ZONE 'America/Sao_Paulo')
              = date_trunc('month', v_hoje::timestamp)), 0),
    'receitaAno', COALESCE((SELECT sum(receita_liquida) FROM base
        WHERE date_trunc('year', atualizado_em AT TIME ZONE 'America/Sao_Paulo')
              = date_trunc('year', v_hoje::timestamp)), 0),
    'receitaPeriodo', COALESCE((SELECT sum(receita_liquida) FROM periodo), 0),
    'pedidosFinalizados', COALESCE((SELECT count(*) FROM periodo), 0),
    'pedidosCancelados', COALESCE((SELECT n FROM cancelados), 0),
    'valorDevolvido', COALESCE((SELECT sum(valor_devolvido) FROM periodo), 0),
    'ticketMedioPeriodo', COALESCE((SELECT CASE WHEN count(*) = 0 THEN 0
        ELSE sum(receita_liquida)/count(*) END FROM periodo), 0),
    'taxaCancelamentoPct', CASE
        WHEN COALESCE((SELECT count(*) FROM periodo),0) + COALESCE((SELECT n FROM cancelados),0) = 0 THEN 0
        ELSE round(100.0 * COALESCE((SELECT n FROM cancelados),0)
             / (COALESCE((SELECT count(*) FROM periodo),0) + COALESCE((SELECT n FROM cancelados),0)), 1)
      END,
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
END $$;
REVOKE ALL ON FUNCTION public.metricas_financeiras(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.metricas_financeiras(text) TO authenticated;

-- ---------------------------------------------------------------------
-- 15. Equipe: pendentes, ativos e inativos (cruzamento no servidor)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_equipe()
RETURNS TABLE(
  user_id uuid, email text, nome text, telefone text,
  perfil_status text, ultimo_acesso timestamptz, criado_em timestamptz,
  roles text[], situacao text
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito ao Admin Master.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id,
         u.email::text,
         COALESCE(NULLIF(btrim(pf.nome),''), split_part(u.email::text,'@',1)),
         pf.telefone,
         COALESCE(pf.status,'ativo'),
         pf.ultimo_acesso,
         u.created_at,
         COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id
                        ORDER BY ur.role::text), ARRAY[]::text[]),
         CASE
           WHEN COALESCE(pf.status,'ativo') = 'inativo' THEN 'inativo'
           WHEN NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
             THEN 'aguardando_liberacao'
           ELSE 'ativo'
         END
    FROM auth.users u
    LEFT JOIN public.profiles pf ON pf.user_id = u.id
   ORDER BY u.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.listar_equipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_equipe() TO authenticated;