import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { InitialsAvatar } from "@/features/admin/components/AdminUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { usePermissions } from "@/features/admin/hooks";
import { EMPLOYEE_ROLES } from "@/features/admin/constants";

const searchSchema = z.object({
  tab: z.enum(["dados", "senha"]).optional(),
});

export const Route = createFileRoute("/_authenticated/admin/perfil")({
  head: () => ({
    meta: [{ title: "Meu perfil — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  validateSearch: searchSchema,
  component: PerfilPage,
});

function PerfilPage() {
  const { tab = "dados" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { roles } = usePermissions();

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [ready, setReady] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
      setEmail(u.email ?? "");
      setNome(meta.full_name ?? meta.name ?? "");
      setReady(true);
    });
  }, []);

  const roleLabel = EMPLOYEE_ROLES.find((r) => roles.includes(r.key))?.label ?? "Sem cargo";

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    const toastId = toast.loading("Salvando…");
    const { error } = await supabase.auth.updateUser({
      data: { full_name: nome.trim() },
    });
    setSavingProfile(false);
    if (error) {
      toast.error("Não foi possível concluir a operação.", { id: toastId });
      return;
    }
    toast.success("Perfil atualizado com sucesso.", { id: toastId });
  };

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title="Meu perfil"
        description="Gerencie seus dados de acesso ao painel administrativo."
      />

      <Card className="flex items-center gap-4 border-[color:var(--border)] bg-[color:var(--cream)] p-5">
        <InitialsAvatar name={nome || email} size={56} />
        <div className="min-w-0">
          <p className="truncate font-display text-2xl text-[color:var(--forest-deep)]">
            {nome || email || "—"}
          </p>
          <p className="truncate text-sm text-[color:var(--muted-foreground)]">{email}</p>
          <p className="mt-1 text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">
            {roleLabel}
          </p>
        </div>
      </Card>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as "dados" | "senha" } })}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="senha">Alterar senha</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <form onSubmit={saveProfile} className="grid max-w-xl gap-4">
            <div className="grid gap-2">
              <Label htmlFor="perfil-nome">Nome</Label>
              <Input
                id="perfil-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={!ready}
                autoComplete="name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="perfil-email">E-mail</Label>
              <Input id="perfil-email" value={email} disabled readOnly />
              <p className="text-xs text-[color:var(--muted-foreground)]">
                A alteração de e-mail é gerenciada pela equipe técnica.
              </p>
            </div>
            <div>
              <Button type="submit" disabled={savingProfile || !ready}>
                {savingProfile && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Salvar alterações
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="senha">
          <ChangePasswordForm />
        </TabsContent>
      </Tabs>
    </>
  );
}

function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const disabled = password.length < 8 || password !== confirm || busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    setBusy(true);
    const toastId = toast.loading("Salvando…");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível concluir a operação.", { id: toastId });
      return;
    }
    setPassword("");
    setConfirm("");
    toast.success("Senha atualizada com sucesso.", { id: toastId });
  };

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button
            type="button"
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={show}
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--forest-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-[color:var(--muted-foreground)]">Mínimo de 8 caracteres.</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Confirmar nova senha</Label>
        <Input
          id="confirm-password"
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          aria-invalid={confirm.length > 0 && confirm !== password}
        />
        {confirm.length > 0 && confirm !== password && (
          <p className="text-xs text-[color:var(--destructive)]">As senhas não coincidem.</p>
        )}
      </div>

      <div>
        <Button type="submit" disabled={disabled}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Atualizar senha
        </Button>
      </div>
    </form>
  );
}
