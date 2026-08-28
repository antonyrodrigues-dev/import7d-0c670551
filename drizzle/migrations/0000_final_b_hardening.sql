-- FINAL-B — Hardening forward-only: allowlist de configurações públicas,
-- invariante "sempre existe 1 Admin Master ativo" e least privilege nas RPCs.

-- 1) Configurações da loja: somente chaves públicas oficiais são aceitas.
CREATE OR REPLACE FUNCTION public.salvar_configuracoes_loja(p_dados jsonb)
 RETURNS public.configuracoes_loja
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.configuracoes_loja;
  v_allowed text[] := ARRAY[
    'whatsapp','telefone','email','instagram','facebook',
    'endereco','cep','cidade','businessHours','pickupSlots',
    'parcelamentoMax','parcelaMinima'
  ];
  v_key text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas o Administrador Master pode alterar as configuracoes da loja';
  END IF;
  IF p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' THEN
    RAISE EXCEPTION 'Configuracoes invalidas';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_dados) LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'Campo de configuracao nao permitido: %', v_key;
    END IF;
  END LOOP;

  INSERT INTO public.configuracoes_loja (id, dados, atualizado_em, atualizado_por)
  VALUES ('default', p_dados, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET dados = EXCLUDED.dados,
        atualizado_em = now(),
        atualizado_por = auth.uid()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- 2) Invariante transacional: sempre resta pelo menos 1 Admin Master ATIVO.
CREATE OR REPLACE FUNCTION public.guard_ultimo_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ativos int;
BEGIN
  -- Serializa qualquer operação que possa remover privilégio de admin.
  PERFORM pg_advisory_xact_lock(hashtext('7d:admin_master'));

  SELECT count(*) INTO v_ativos
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'admin' AND p.status = 'ativo';

  IF v_ativos = 0 THEN
    RAISE EXCEPTION 'Operacao recusada: e obrigatorio manter ao menos um Administrador Master ativo';
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_ultimo_admin_roles ON public.user_roles;
CREATE CONSTRAINT TRIGGER trg_guard_ultimo_admin_roles
  AFTER UPDATE OR DELETE ON public.user_roles
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.guard_ultimo_admin();

DROP TRIGGER IF EXISTS trg_guard_ultimo_admin_profiles ON public.profiles;
CREATE CONSTRAINT TRIGGER trg_guard_ultimo_admin_profiles
  AFTER UPDATE OR DELETE ON public.profiles
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.guard_ultimo_admin();

-- 3) Least privilege: anon só mantém o que o checkout público realmente usa.
REVOKE EXECUTE ON FUNCTION public.salvar_configuracoes_loja(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.avaliar_publicacao(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.diagnostico_catalogo() FROM anon;
REVOKE EXECUTE ON FUNCTION public.qualidade_catalogo() FROM anon;
REVOKE EXECUTE ON FUNCTION public.explodir_item_pedido(text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.kit_disponivel(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.expirar_reservas_variacao(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.parametro_int(text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolver_pendencias_pedido(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_pendencias_pedido(uuid, jsonb, text) TO authenticated;
