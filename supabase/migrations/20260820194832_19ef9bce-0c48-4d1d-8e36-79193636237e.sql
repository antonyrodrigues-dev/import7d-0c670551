CREATE TABLE public.configuracoes_loja (
  id text PRIMARY KEY DEFAULT 'default',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid,
  CONSTRAINT configuracoes_loja_singleton CHECK (id = 'default')
);

GRANT SELECT ON public.configuracoes_loja TO anon;
GRANT SELECT ON public.configuracoes_loja TO authenticated;
GRANT ALL ON public.configuracoes_loja TO service_role;

ALTER TABLE public.configuracoes_loja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Configuracoes da loja sao publicas para leitura"
ON public.configuracoes_loja FOR SELECT
TO anon, authenticated
USING (true);

INSERT INTO public.configuracoes_loja (id, dados) VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Escrita apenas pelo Admin Master, por rotina auditada.
CREATE OR REPLACE FUNCTION public.salvar_configuracoes_loja(p_dados jsonb)
RETURNS public.configuracoes_loja
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.configuracoes_loja;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas o Administrador Master pode alterar as configuracoes da loja';
  END IF;
  IF p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' THEN
    RAISE EXCEPTION 'Configuracoes invalidas';
  END IF;

  INSERT INTO public.configuracoes_loja (id, dados, atualizado_em, atualizado_por)
  VALUES ('default', p_dados, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET dados = EXCLUDED.dados,
        atualizado_em = now(),
        atualizado_por = auth.uid()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_configuracoes_loja(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_configuracoes_loja(jsonb) TO authenticated;