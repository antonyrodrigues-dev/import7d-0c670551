import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REMEMBER_KEY = "7d-admin-remember-email";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso restrito — 7D IMPORTS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [remember, setRemember] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin" });
    });
  }, [navigate]);

  useEffect(() => {
    // Restaura apenas o e-mail (nunca a senha).
    try {
      const stored = localStorage.getItem(REMEMBER_KEY);
      if (stored) {
        setEmail(stored);
        setRemember(true);
      }
    } catch {
      // localStorage indisponível — ignorar silenciosamente.
    }
    emailRef.current?.focus();
  }, []);

  const detectCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const state = e.getModifierState?.("CapsLock");
    if (typeof state === "boolean") setCapsLock(state);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const toastId = toast.loading("Autenticando…");
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signErr) {
      toast.error("Credenciais inválidas. Verifique e tente novamente.", {
        id: toastId,
      });
      return;
    }
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      // ignore
    }
    toast.success("Acesso liberado. Redirecionando…", { id: toastId });
    navigate({ to: "/admin" });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[color:var(--cream)] px-6 py-10 text-[color:var(--forest-deep)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md"
        aria-describedby="auth-restricted-note"
      >
        <div className="flex items-center gap-2 text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Acesso restrito
        </div>
        <h1 className="mt-4 font-display text-4xl">Atendimento 7D</h1>
        <p className="mt-3 font-display italic text-base text-[color:var(--muted-foreground)]">
          Área exclusiva para a equipe de atendimento.
        </p>

        <div
          id="auth-restricted-note"
          className="mt-6 flex gap-3 border border-[color:var(--border)] bg-[color:var(--cream-deep)]/40 p-4 text-xs text-[color:var(--forest-deep)]"
        >
          <Lock
            className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest-deep)]"
            aria-hidden="true"
          />
          <p>
            Acesso exclusivo para funcionários autorizados da 7D Imports. Todas as ações realizadas
            neste painel podem ser registradas para auditoria.
          </p>
        </div>

        <div className="mt-8 space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="auth-email">E-mail</Label>
            <Input
              ref={emailRef}
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="auth-password">Senha</Label>
            <div className="relative">
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={detectCaps}
                onKeyUp={detectCaps}
                disabled={loading}
                aria-describedby={capsLock ? "auth-caps-warning" : undefined}
                className="pr-10"
              />
              <button
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--forest-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {capsLock && (
              <p
                id="auth-caps-warning"
                role="status"
                className="text-[11px] tracking-luxe uppercase text-[color:var(--gold)]"
              >
                Caps Lock está ativo
              </p>
            )}
          </div>

          <label
            htmlFor="auth-remember"
            className="flex items-center gap-2 text-sm text-[color:var(--forest-deep)]"
          >
            <Checkbox
              id="auth-remember"
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
              disabled={loading}
            />
            <span>Lembrar meu e-mail neste dispositivo</span>
          </label>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-8 h-14 w-full text-[11px] tracking-luxe uppercase"
          size="lg"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
