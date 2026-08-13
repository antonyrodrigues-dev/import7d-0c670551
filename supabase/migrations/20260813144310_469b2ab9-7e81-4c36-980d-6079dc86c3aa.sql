-- ============ Parâmetros operacionais anti-abuso ============
INSERT INTO public.parametros_operacionais (chave, valor, descricao) VALUES
  ('checkout_cooldown_segundos', '45'::jsonb, 'Intervalo mínimo, em segundos, entre pedidos do mesmo telefone'),
  ('checkout_max_pedidos_abertos', '3'::jsonb, 'Máximo de pedidos em aberto simultâneos por telefone'),
  ('checkout_max_reservas_ativas', '5'::jsonb, 'Máximo de peças reservadas ativas por telefone'),
  ('checkout_max_pedidos_hora', '6'::jsonb, 'Máximo de pedidos criados por telefone em 60 minutos')
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.parametro_int(p_chave text, p_default int)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT NULLIF(valor #>> '{}', '')::int
                     FROM public.parametros_operacionais WHERE chave = p_chave), p_default)
$$;

-- ============ Registro de tentativas bloqueadas ============
CREATE TABLE IF NOT EXISTS public.checkout_bloqueios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_mascarado text NOT NULL,
  telefone_hash text NOT NULL,
  motivo text NOT NULL,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.checkout_bloqueios TO authenticated;
GRANT ALL ON public.checkout_bloqueios TO service_role;

ALTER TABLE public.checkout_bloqueios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin master lê bloqueios de checkout" ON public.checkout_bloqueios;
CREATE POLICY "Admin master lê bloqueios de checkout"
  ON public.checkout_bloqueios FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_checkout_bloqueios_criado_em
  ON public.checkout_bloqueios (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_bloqueios_hash
  ON public.checkout_bloqueios (telefone_hash, criado_em DESC);

CREATE OR REPLACE FUNCTION public.checkout_bloqueios_imutavel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Registro de bloqueios de checkout é imutável.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_checkout_bloqueios_imutavel ON public.checkout_bloqueios;
CREATE TRIGGER trg_checkout_bloqueios_imutavel
  BEFORE UPDATE OR DELETE ON public.checkout_bloqueios
  FOR EACH ROW EXECUTE FUNCTION public.checkout_bloqueios_imutavel();

-- ============ Índices de suporte por telefone ============
CREATE INDEX IF NOT EXISTS idx_pedidos_telefone_criado
  ON public.pedidos (((itens -> 'cliente') ->> 'telefone'), criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_reservas_estoque_estado
  ON public.reservas_estoque (estado, pedido_id);

-- ============ Guarda anti-abuso ============
CREATE OR REPLACE FUNCTION public.checkout_guard_antiabuso(p_telefone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cooldown int := public.parametro_int('checkout_cooldown_segundos', 45);
  v_max_abertos int := public.parametro_int('checkout_max_pedidos_abertos', 3);
  v_max_reservas int := public.parametro_int('checkout_max_reservas_ativas', 5);
  v_max_hora int := public.parametro_int('checkout_max_pedidos_hora', 6);
  v_ultimo timestamptz;
  v_abertos int;
  v_reservas int;
  v_hora int;
  v_mask text := repeat('*', greatest(length(p_telefone) - 4, 0)) || right(p_telefone, 4);
  v_hash text := encode(digest(p_telefone, 'sha256'), 'hex');

  PROCEDURE_PLACEHOLDER boolean;
BEGIN
  SELECT max(criado_em) INTO v_ultimo
    FROM public.pedidos
   WHERE (itens -> 'cliente') ->> 'telefone' = p_telefone;

  IF v_ultimo IS NOT NULL AND v_ultimo > now() - make_interval(secs => v_cooldown) THEN
    INSERT INTO public.checkout_bloqueios (telefone_mascarado, telefone_hash, motivo, detalhe)
    VALUES (v_mask, v_hash, 'cooldown', jsonb_build_object('cooldown_segundos', v_cooldown));
    RAISE EXCEPTION 'Aguarde % segundos antes de enviar um novo pedido.',
      ceil(extract(epoch FROM (v_ultimo + make_interval(secs => v_cooldown)) - now()))::int
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_hora
    FROM public.pedidos
   WHERE (itens -> 'cliente') ->> 'telefone' = p_telefone
     AND criado_em > now() - interval '1 hour';

  IF v_hora >= v_max_hora THEN
    INSERT INTO public.checkout_bloqueios (telefone_mascarado, telefone_hash, motivo, detalhe)
    VALUES (v_mask, v_hash, 'limite_hora', jsonb_build_object('limite', v_max_hora, 'atual', v_hora));
    RAISE EXCEPTION 'Limite de pedidos por hora atingido para este telefone. Fale com a loja pelo WhatsApp.'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_abertos
    FROM public.pedidos
   WHERE (itens -> 'cliente') ->> 'telefone' = p_telefone
     AND status NOT IN ('finalizado', 'cancelado', 'devolvido');

  IF v_abertos >= v_max_abertos THEN
    INSERT INTO public.checkout_bloqueios (telefone_mascarado, telefone_hash, motivo, detalhe)
    VALUES (v_mask, v_hash, 'pedidos_abertos', jsonb_build_object('limite', v_max_abertos, 'atual', v_abertos));
    RAISE EXCEPTION 'Você já possui % pedidos em andamento. Finalize-os antes de criar outro.', v_abertos
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(sum(r.quantidade), 0) INTO v_reservas
    FROM public.reservas_estoque r
    JOIN public.pedidos p ON p.id = r.pedido_id
   WHERE r.estado = 'ativa'
     AND r.expira_em > now()
     AND (p.itens -> 'cliente') ->> 'telefone' = p_telefone;

  IF v_reservas >= v_max_reservas THEN
    INSERT INTO public.checkout_bloqueios (telefone_mascarado, telefone_hash, motivo, detalhe)
    VALUES (v_mask, v_hash, 'reservas_ativas', jsonb_build_object('limite', v_max_reservas, 'atual', v_reservas));
    RAISE EXCEPTION 'Você já possui % peças reservadas. Conclua o atendimento antes de reservar mais.', v_reservas
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_guard_antiabuso(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parametro_int(text, int) TO authenticated, service_role;