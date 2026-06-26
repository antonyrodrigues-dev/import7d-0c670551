
-- 1. Roles enum + tabela
CREATE TYPE public.app_role AS ENUM ('admin', 'atendente');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer p/ checar role sem recursão
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Sequence para numero_pedido
CREATE SEQUENCE public.pedidos_numero_seq START 1;

CREATE OR REPLACE FUNCTION public.gerar_numero_pedido()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT '7D-' || lpad(nextval('public.pedidos_numero_seq')::text, 4, '0')
$$;

-- 3. Tabela pedidos
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido text NOT NULL UNIQUE DEFAULT public.gerar_numero_pedido(),
  itens jsonb NOT NULL,
  valor_total numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  atendente_nome text,
  canal text NOT NULL DEFAULT 'whatsapp',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Sequence usage
GRANT USAGE, SELECT ON SEQUENCE public.pedidos_numero_seq TO anon, authenticated;

-- Grants tabela
GRANT INSERT ON public.pedidos TO anon;
GRANT SELECT, INSERT, UPDATE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Anon: pode INSERT apenas com status pendente, sem SELECT/UPDATE/DELETE
CREATE POLICY "Anon can insert pending orders"
ON public.pedidos FOR INSERT TO anon
WITH CHECK (status = 'pendente');

-- Atendentes/admins autenticados podem ler e atualizar
CREATE POLICY "Staff can view all orders"
ON public.pedidos FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'atendente')
);

CREATE POLICY "Staff can update orders"
ON public.pedidos FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'atendente')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'atendente')
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$;

CREATE TRIGGER pedidos_set_updated_at
BEFORE UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX pedidos_status_criado_idx ON public.pedidos (status, criado_em DESC);
