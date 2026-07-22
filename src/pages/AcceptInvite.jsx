import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useOrgStore } from "../store/orgStore";

/*
  Aceite de convite via link com token (/convite/:token).
  Renderiza em ambas as árvores de rota (logado e deslogado) — a própria
  tela decide o que mostrar com base em `user`.
*/
export function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuthStore();
  const { acceptInvite } = useOrgStore();

  const [state, setState] = useState("idle"); // idle | accepting | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || !token) return;
    let cancelled = false;
    setState("accepting");
    acceptInvite(token)
      .then(() => { if (!cancelled) { setState("success"); } })
      .catch((e) => {
        if (!cancelled) {
          setState("error");
          setMessage(e?.message ?? "Não foi possível aceitar o convite.");
        }
      });
    return () => { cancelled = true; };
  }, [user, token]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
        {!user ? (
          <>
            <span className="text-4xl">🤝</span>
            <h2 className="text-lg font-semibold text-text-main">Você foi convidado</h2>
            <p className="text-sm text-text-secondary">
              Entre com sua conta Google para aceitar o convite e acessar o espaço da equipe.
            </p>
            <button
              onClick={() => signInWithGoogle(window.location.href)}
              className="w-full flex items-center justify-center gap-3 bg-white border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-[#1C1C1E] hover:bg-bg transition-colors shadow-sm"
            >
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </button>
          </>
        ) : state === "accepting" || state === "idle" ? (
          <>
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-text-secondary">Aceitando convite…</p>
          </>
        ) : state === "success" ? (
          <>
            <span className="text-4xl">🎉</span>
            <h2 className="text-lg font-semibold text-text-main">Bem-vindo à equipe!</h2>
            <p className="text-sm text-text-secondary">
              Seu acesso foi liberado. Suas tarefas pessoais continuam privadas — só o que for da
              organização passa a ser compartilhado com sua liderança.
            </p>
            <button
              onClick={() => navigate("/today")}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Ir para o app
            </button>
          </>
        ) : (
          <>
            <span className="text-4xl">😕</span>
            <h2 className="text-lg font-semibold text-text-main">Convite não aceito</h2>
            <p className="text-sm text-text-secondary">{message}</p>
            <button
              onClick={() => navigate("/today")}
              className="text-sm text-primary hover:underline"
            >
              Ir para o app
            </button>
          </>
        )}
      </div>
    </div>
  );
}
