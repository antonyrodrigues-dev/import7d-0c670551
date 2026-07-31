-- ============================================================
-- ONDA 0 — Fundação de banco da camada de aplicação
-- ============================================================

-- 1. DISPONIBILIDADE REAL -------------------------------------------------
ALTER TABLE public.produto_variacoes DROP COLUMN IF EXISTS disponivel;
ALTER TABLE public.produto_variacoes
  ADD COLUMN disponivel integer
  GENERATED ALWAYS AS (GREATEST(0, quantidade - quantidade_reservada - quantidade_quarentena)) STORED;

ALTER TABLE public.produto_variacoes DROP CONSTRAINT IF EXISTS produto_variacoes_quarentena_max_check;
ALTER TABLE public.produto_variacoes DROP CONSTRAINT IF EXISTS produto_variacoes_soma_check;
ALTER TABLE public.produto_variacoes
  ADD CONSTRAINT produto_variacoes_quarentena_max_check
  CHECK (quantidade_quarentena >= 0 AND quantidade_quarentena <= quantidade);
ALTER TABLE public.produto_variacoes
  ADD CONSTRAINT produto_variacoes_soma_check
  CHECK (quantidade_reservada + quantidade_quarentena <= quantidade);

-- 2. FUNCIONÁRIO INATIVO PERDE ACESSO REAL --------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
     WHERE ur.user_id = _user_id
       AND ur.role = _role
       AND COALESCE((SELECT pf.status FROM public.profiles pf WHERE pf.user_id = _user_id), 'ativo') <> 'inativo'
  )
$$;

-- 3. NOTIFICAÇÕES PERSISTENTES --------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  severidade text NOT NULL DEFAULT 'info' CHECK (severidade IN ('info','sucesso','alerta','critico')),
  entidade text,
  entidade_id uuid,
  dedupe_key text NOT NULL UNIQUE,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notificacao_leituras (
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notificacao_id, user_id)
);

CREATE INDEX IF NOT EXISTS notificacoes_criado_em_idx ON public.notificacoes (criado_em DESC);

GRANT SELECT ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
GRANT SELECT, INSERT, DELETE ON public.notificacao_leituras TO authenticated;
GRANT ALL ON public.notificacao_leituras TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacao_leituras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe lê notificações" ON public.notificacoes;
CREATE POLICY "Equipe lê notificações" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));

DROP POLICY IF EXISTS "Leitura própria" ON public.notificacao_leituras;
CREATE POLICY "Leitura própria" ON public.notificacao_leituras
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.emitir_notificacao(
  p_tipo text, p_titulo text, p_mensagem text, p_dedupe_key text,
  p_severidade text DEFAULT 'info', p_entidade text DEFAULT NULL,
  p_entidade_id uuid DEFAULT NULL, p_detalhe jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notificacoes (tipo, titulo, mensagem, dedupe_key, severidade, entidade, entidade_id, detalhe)
  VALUES (p_tipo, p_titulo, p_mensagem, p_dedupe_key, p_severidade, p_entidade, p_entidade_id, COALESCE(p_detalhe,'{}'::jsonb))
  ON CONFLICT (dedupe_key) DO NOTHING;
$$;
REVOKE EXECUTE ON FUNCTION public.emitir_notificacao(text,text,text,text,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;

-- Eventos de pedido geram notificação (idempotente por dedupe_key)
CREATE OR REPLACE FUNCTION public.notificar_pedido_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text; v_msg text; v_sev text := 'info'; v_key text;
BEGIN
  v_key := NEW.tipo || ':' || NEW.pedido_id::text || ':' || COALESCE(NEW.detalhe->>'estado', NEW.detalhe->>'para', '');
  CASE NEW.tipo
    WHEN 'pedido.criado' THEN v_titulo := 'Novo pedido'; v_msg := 'Pedido ' || NEW.numero_pedido || ' registrado.';
    WHEN 'pedido.whatsapp_declarado' THEN v_titulo := 'Cliente declarou envio'; v_msg := 'Pedido ' || NEW.numero_pedido || ' confirmado pelo cliente no WhatsApp.';
    WHEN 'atendimento.assumido' THEN v_titulo := 'Atendimento assumido'; v_msg := 'Pedido ' || NEW.numero_pedido || ' assumido por ' || COALESCE(NEW.detalhe->>'responsavel','equipe') || '.';
    WHEN 'atendimento.transferido' THEN v_titulo := 'Atendimento transferido'; v_msg := 'Pedido ' || NEW.numero_pedido || ' transferido para ' || COALESCE(NEW.detalhe->>'para','equipe') || '.';
    WHEN 'atendimento.devolvido_fila' THEN v_titulo := 'Pedido devolvido à fila'; v_msg := 'Pedido ' || NEW.numero_pedido || ' voltou para a fila.'; v_sev := 'alerta';
    WHEN 'pagamento.estado' THEN
      v_titulo := 'Pagamento ' || COALESCE(NEW.detalhe->>'estado','atualizado');
      v_msg := 'Pedido ' || NEW.numero_pedido || ' — pagamento ' || COALESCE(NEW.detalhe->>'estado','atualizado') || '.';
      v_sev := CASE NEW.detalhe->>'estado' WHEN 'confirmado' THEN 'sucesso' WHEN 'recusado' THEN 'critico' ELSE 'info' END;
    WHEN 'pedido.devolvido' THEN v_titulo := 'Devolução aprovada'; v_msg := 'Pedido ' || NEW.numero_pedido || ' teve devolução registrada.'; v_sev := 'alerta';
    WHEN 'pedido.cancelado' THEN v_titulo := 'Pedido cancelado'; v_msg := 'Pedido ' || NEW.numero_pedido || ' foi cancelado.'; v_sev := 'alerta';
    ELSE RETURN NEW;
  END CASE;

  PERFORM public.emitir_notificacao(NEW.tipo, v_titulo, v_msg, v_key, v_sev, 'pedido', NEW.pedido_id, NEW.detalhe);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_pedido_evento ON public.pedido_eventos;
CREATE TRIGGER trg_notificar_pedido_evento
AFTER INSERT ON public.pedido_eventos
FOR EACH ROW EXECUTE FUNCTION public.notificar_pedido_evento();

CREATE OR REPLACE FUNCTION public.notificar_pedido_novo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.emitir_notificacao(
    'pedido.novo', 'Novo pedido na fila',
    'Pedido ' || NEW.numero_pedido || ' aguardando atendimento.',
    'pedido.novo:' || NEW.id::text, 'info', 'pedido', NEW.id,
    jsonb_build_object('numero', NEW.numero_pedido, 'valor', NEW.valor_total));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notificar_pedido_novo ON public.pedidos;
CREATE TRIGGER trg_notificar_pedido_novo
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.notificar_pedido_novo();

-- 4. DEVOLUÇÃO AVARIADA MANTÉM O INVARIANTE -------------------------------
DROP FUNCTION IF EXISTS public.registrar_devolucao(uuid,jsonb,text,numeric,text,jsonb);
CREATE OR REPLACE FUNCTION public.registrar_devolucao(
  p_pedido_id uuid, p_itens jsonb, p_motivo text,
  p_valor_estornado numeric, p_observacoes text, p_evidencias jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_dev_id uuid;
  v_item jsonb;
  v_slug text; v_size text; v_qty int; v_cond text;
  v_produto_id uuid; v_current int;
  v_vendido int; v_ja_devolvido int;
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
  IF v_pedido.status NOT IN ('finalizado','devolvido') THEN
    RAISE EXCEPTION 'Somente pedidos finalizados podem ser devolvidos.' USING ERRCODE = '23514';
  END IF;
  IF COALESCE(p_valor_estornado,0) < 0
     OR (v_pedido.valor_devolvido + COALESCE(p_valor_estornado,0)) > v_pedido.valor_total THEN
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
    IF v_cond NOT IN ('vendavel','usada','avariada','defeituosa','divergencia','outra') THEN
      RAISE EXCEPTION 'Condição da peça inválida.' USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(SUM((p->>'quantity')::int), 0) INTO v_vendido
      FROM jsonb_array_elements(v_pedido.itens->'produtos') p
     WHERE p->>'slug' = v_slug AND p->>'size' = v_size;

    SELECT COALESCE(SUM(di.quantidade), 0) INTO v_ja_devolvido
      FROM public.pedido_devolucao_itens di
      JOIN public.pedido_devolucoes d ON d.id = di.devolucao_id
     WHERE d.pedido_id = p_pedido_id AND di.slug = v_slug AND di.tamanho = v_size
       AND di.devolucao_id <> v_dev_id;

    IF (v_ja_devolvido + v_qty) > v_vendido THEN
      RAISE EXCEPTION 'Quantidade devolvida maior que a vendida (% tam %).', v_slug, v_size
        USING ERRCODE = '22023';
    END IF;

    SELECT produtos.id INTO v_produto_id FROM public.produtos WHERE produtos.slug = v_slug;
    IF v_produto_id IS NULL THEN
      RAISE EXCEPTION 'Produto da devolução não localizado (%).', v_slug USING ERRCODE = 'P0002';
    END IF;

    SELECT quantidade INTO v_current
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
      -- Peça volta fisicamente, porém em quarentena (não vendável).
      UPDATE public.produto_variacoes
         SET quantidade = quantidade + v_qty,
             quantidade_quarentena = quantidade_quarentena + v_qty,
             atualizado_em = now()
       WHERE produto_id = v_produto_id AND tamanho = v_size;
      INSERT INTO public.produto_movimentacoes
        (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id,
         saldo_anterior, saldo_posterior, motivo)
      VALUES (v_produto_id, v_size, 'quarentena', v_qty, v_uid,
              format('Quarentena — devolução do pedido %s', v_pedido.numero_pedido), v_pedido.id,
              v_current, v_current + v_qty, format('%s (%s)', btrim(p_motivo), v_cond));
      PERFORM public.emitir_notificacao(
        'estoque.quarentena', 'Peça enviada à quarentena',
        format('%s (%s) — %s un. do pedido %s', v_slug, v_size, v_qty, v_pedido.numero_pedido),
        'estoque.quarentena:' || v_dev_id::text || ':' || v_slug || ':' || v_size,
        'alerta', 'produto', v_produto_id, jsonb_build_object('condicao', v_cond));
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
END;
$$;

-- 5. EXPIRAÇÃO AUTOMÁTICA -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_execucoes_criado_em_idx ON public.job_execucoes (job, criado_em DESC);
GRANT SELECT ON public.job_execucoes TO authenticated;
GRANT ALL ON public.job_execucoes TO service_role;
ALTER TABLE public.job_execucoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin lê execuções" ON public.job_execucoes;
CREATE POLICY "Admin lê execuções" ON public.job_execucoes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.expirar_reservas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count int := 0;
  v_numero text;
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

    SELECT numero_pedido INTO v_numero FROM public.pedidos WHERE id = r.pedido_id;
    PERFORM public.emitir_notificacao(
      'reserva.expirada', 'Reserva expirada',
      format('Reserva do pedido %s expirou e o estoque foi liberado.', COALESCE(v_numero,'—')),
      'reserva.expirada:' || r.id::text, 'alerta', 'pedido', r.pedido_id, '{}'::jsonb);

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.expirar_reservas() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.job_expirar_reservas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int;
BEGIN
  v_n := public.expirar_reservas();
  INSERT INTO public.job_execucoes (job, resultado)
  VALUES ('expirar_reservas', jsonb_build_object('expiradas', v_n));
  DELETE FROM public.job_execucoes
   WHERE job = 'expirar_reservas' AND criado_em < now() - interval '7 days';
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.job_expirar_reservas() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
DO $$
BEGIN
  PERFORM cron.unschedule('7d-expirar-reservas');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('7d-expirar-reservas', '* * * * *', $$SELECT public.job_expirar_reservas();$$);

-- 6. PARÂMETROS OPERACIONAIS ----------------------------------------------
INSERT INTO public.parametros_operacionais (chave, valor, descricao) VALUES
  ('reserva_peca_unica_minutos', '20'::jsonb, 'Minutos de reserva temporária para peça única'),
  ('alerta_atendimento_minutos', '5'::jsonb, 'Minutos até alertar pedido aguardando atendimento'),
  ('atendimento_atrasado_minutos', '10'::jsonb, 'Minutos até marcar atendimento como atrasado'),
  ('confirmacao_cliente_minutos', '30'::jsonb, 'Prazo máximo para o cliente confirmar o envio no WhatsApp')
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.definir_parametro(p_chave text, p_valor jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min int; v_max int; v_anterior jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master altera parâmetros.' USING ERRCODE = '42501';
  END IF;

  SELECT CASE p_chave
    WHEN 'reserva_peca_unica_minutos' THEN 5
    WHEN 'alerta_atendimento_minutos' THEN 1
    WHEN 'atendimento_atrasado_minutos' THEN 2
    WHEN 'confirmacao_cliente_minutos' THEN 5
  END,
  CASE p_chave
    WHEN 'reserva_peca_unica_minutos' THEN 120
    WHEN 'alerta_atendimento_minutos' THEN 60
    WHEN 'atendimento_atrasado_minutos' THEN 240
    WHEN 'confirmacao_cliente_minutos' THEN 1440
  END INTO v_min, v_max;

  IF v_min IS NULL THEN
    RAISE EXCEPTION 'Parâmetro desconhecido: %', p_chave USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_valor) <> 'number' OR (p_valor)::int < v_min OR (p_valor)::int > v_max THEN
    RAISE EXCEPTION 'Valor de % deve ficar entre % e % minutos.', p_chave, v_min, v_max USING ERRCODE = '22023';
  END IF;

  SELECT valor INTO v_anterior FROM public.parametros_operacionais WHERE chave = p_chave;

  INSERT INTO public.parametros_operacionais (chave, valor, atualizado_em, atualizado_por)
  VALUES (p_chave, p_valor, now(), auth.uid())
  ON CONFLICT (chave) DO UPDATE
    SET valor = EXCLUDED.valor, atualizado_em = now(), atualizado_por = auth.uid();

  PERFORM public.emitir_notificacao(
    'parametro.alterado', 'Parâmetro operacional alterado',
    format('%s: %s → %s', p_chave, COALESCE(v_anterior::text,'—'), p_valor::text),
    'parametro.alterado:' || p_chave || ':' || extract(epoch from now())::bigint::text,
    'info', 'parametro', NULL,
    jsonb_build_object('chave', p_chave, 'de', v_anterior, 'para', p_valor));
END;
$$;
