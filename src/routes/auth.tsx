import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signErr) {
      setError("Credenciais inválidas. Verifique e tente novamente.");
      return;
    }
    navigate({ to: "/admin" });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[color:var(--cream)] px-6 text-[color:var(--forest-deep)]">
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">
          Acesso restrito
        </p>
        <h1 className="mt-4 font-display text-4xl">Atendimento 7D</h1>
        <p className="mt-3 font-display italic text-base text-[color:var(--muted-foreground)]">
          Área exclusiva para a equipe de atendimento.
        </p>

        <div className="mt-10 space-y-5">
          <label className="block">
            <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              E-mail
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 block h-12 w-full border border-[color:var(--border)] bg-[color:var(--cream)] px-4 text-base text-[color:var(--forest-deep)] focus:border-[color:var(--forest-deep)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Senha
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 block h-12 w-full border border-[color:var(--border)] bg-[color:var(--cream)] px-4 text-base text-[color:var(--forest-deep)] focus:border-[color:var(--forest-deep)] focus:outline-none"
            />
          </label>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 text-[11px] tracking-luxe uppercase text-[color:var(--destructive)]"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-8 inline-flex h-14 w-full items-center justify-center bg-[color:var(--forest-deep)] text-[11px] tracking-luxe uppercase text-[color:var(--cream)] transition-colors hover:bg-[color:var(--forest)] disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
