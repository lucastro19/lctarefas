import { useState } from "react";
import { useAuthStore } from "../store/authStore";

export function Login() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuthStore();

  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (mode === "reset") {
        await resetPassword(email);
        setSuccess("Link de redefinição enviado para seu email.");
        return;
      }
      if (mode === "signup") {
        if (!fullName.trim()) { setError("Informe seu nome."); return; }
        if (password.length < 6) { setError("A senha deve ter ao menos 6 caracteres."); return; }
        const data = await signUpWithEmail(email, password, fullName.trim());
        if (data?.user && !data.session) {
          setSuccess("Conta criada! Verifique seu email para confirmar o cadastro.");
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      const msgs = {
        "Invalid login credentials": "Email ou senha incorretos.",
        "Email not confirmed": "Confirme seu email antes de entrar.",
        "User already registered": "Este email já está cadastrado.",
        "Password should be at least 6 characters": "A senha deve ter ao menos 6 caracteres.",
      };
      setError(msgs[err.message] ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-card rounded-2xl shadow-md border border-border p-8 w-full max-w-sm flex flex-col gap-5">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <img src="/lc-logo.png" alt="LC" className="w-14 h-14 object-contain" />
          <div className="text-center">
            <h1 className="text-xl font-semibold text-text-main">
              <span className="text-primary font-bold">LC</span>Tarefas
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">Gestão de tarefas pessoais</p>
          </div>
        </div>

        {/* Entrar com Google */}
        {mode !== "reset" && (
          <>
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-text-main hover:bg-bg transition-colors shadow-sm w-full justify-center"
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-text-secondary">ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </>
        )}

        {/* Formulário email/senha */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Seu nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="text-sm bg-bg border border-border rounded-xl px-3.5 py-2.5 outline-none focus:border-primary text-text-main placeholder:text-text-secondary w-full"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="text-sm bg-bg border border-border rounded-xl px-3.5 py-2.5 outline-none focus:border-primary text-text-main placeholder:text-text-secondary w-full"
          />
          {mode !== "reset" && (
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="text-sm bg-bg border border-border rounded-xl px-3.5 py-2.5 outline-none focus:border-primary text-text-main placeholder:text-text-secondary w-full"
            />
          )}

          {error && (
            <p className="text-xs text-danger bg-danger/8 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-xs text-success bg-success/8 border border-success/20 rounded-lg px-3 py-2">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 w-full"
          >
            {loading
              ? "Aguarde..."
              : mode === "signup"
              ? "Criar conta"
              : mode === "reset"
              ? "Enviar link"
              : "Entrar"}
          </button>
        </form>

        {/* Troca de modo */}
        <div className="flex flex-col items-center gap-1.5">
          {mode === "signin" && (
            <>
              <button
                onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                className="text-xs text-primary hover:underline"
              >
                Não tem conta? Criar agora
              </button>
              <button
                onClick={() => { setMode("reset"); setError(""); setSuccess(""); }}
                className="text-xs text-text-secondary hover:text-text-main"
              >
                Esqueci minha senha
              </button>
            </>
          )}
          {(mode === "signup" || mode === "reset") && (
            <button
              onClick={() => { setMode("signin"); setError(""); setSuccess(""); }}
              className="text-xs text-text-secondary hover:text-text-main"
            >
              ← Voltar para o login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
