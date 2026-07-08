
-- Bootstrap MVP: garantir que exista pelo menos um Administrador Master.
-- Regra: se ainda não houver nenhum usuário com o papel 'admin', o próximo
-- usuário que se cadastrar (ou o único existente hoje) recebe automaticamente
-- 'admin'. Substituir esta regra por gestão manual quando o painel de
-- funcionários passar a criar contas via Auth Admin API.

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT DO NOTHING;

-- Trigger para novos usuários enquanto o MVP não tiver gestão de funcionários.
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrap_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();
