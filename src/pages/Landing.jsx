import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: "☀️",
    title: "Planeje seu dia",
    desc: "Organize as tarefas por Manhã, Tarde e Noite com horários automáticos e lembretes inteligentes.",
  },
  {
    icon: "📂",
    title: "Áreas e Projetos",
    desc: "Agrupe tarefas em projetos dentro de áreas de vida — trabalho, pessoal, finanças — do jeito que você pensa.",
  },
  {
    icon: "🔔",
    title: "Notificações precisas",
    desc: "Lembretes antecipados configuráveis, avisos de prazo e resumo matinal automático às 8h.",
  },
  {
    icon: "⚡",
    title: "Funciona offline",
    desc: "Crie e edite tarefas sem internet. Tudo sincroniza automaticamente quando a conexão volta.",
  },
  {
    icon: "🎯",
    title: "Modo Foco",
    desc: "Filtre apenas o que importa agora — tarefas por prioridade, sem distrações.",
  },
  {
    icon: "📱",
    title: "Mobile first",
    desc: "Instale como app no iPhone ou Android. Interface pensada para uso rápido, a qualquer momento.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "R$ 0",
    period: "para sempre",
    color: "border-border",
    badge: null,
    features: [
      "150 tarefas ativas",
      "3 áreas",
      "10 projetos",
      "10 etiquetas",
      "Notificações push",
      "Sincronização em tempo real",
      "Acesso web + PWA",
    ],
    cta: "Criar conta grátis",
    ctaStyle: "border border-primary text-primary hover:bg-primary hover:text-white",
  },
  {
    name: "Pro",
    price: "R$ 19",
    period: "por mês",
    color: "border-primary ring-2 ring-primary/20",
    badge: "Mais popular",
    features: [
      "Tarefas ilimitadas",
      "Áreas ilimitadas",
      "Projetos ilimitados",
      "Etiquetas ilimitadas",
      "Notificações push",
      "Sincronização em tempo real",
      "Acesso web + PWA + Android",
      "Suporte prioritário",
    ],
    cta: "Começar com Pro",
    ctaStyle: "bg-primary text-white hover:bg-primary/90",
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-[#F2F2F7] font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-[#E5E5EA]">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/lc-logo.png" alt="LC" className="w-8 h-8 object-contain" />
            <span className="font-bold text-base text-[#1C1C1E]">
              <span className="text-[#4F8EF7]">LC</span>Tarefas
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-[#8E8E93] hover:text-[#1C1C1E] transition-colors"
            >
              Entrar
            </Link>
            <Link
              to="/login"
              className="text-sm bg-[#4F8EF7] text-white px-4 py-1.5 rounded-full font-medium hover:bg-[#4F8EF7]/90 transition-colors"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-[#4F8EF7]/10 text-[#4F8EF7] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          ✨ Grátis para começar — sem cartão de crédito
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-[#1C1C1E] leading-tight mb-5">
          Organize sua vida com<br />
          <span className="text-[#4F8EF7]">clareza e intenção</span>
        </h1>
        <p className="text-lg text-[#8E8E93] max-w-xl mx-auto mb-8 leading-relaxed">
          LCTarefas é um app de gestão de tarefas pessoais inspirado no Things 3.
          Planeje seu dia, semana e vida em um só lugar — simples, rápido e offline.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/login"
            className="bg-[#4F8EF7] text-white px-7 py-3 rounded-xl font-semibold text-sm hover:bg-[#4F8EF7]/90 transition-colors shadow-lg shadow-[#4F8EF7]/20"
          >
            Começar grátis →
          </Link>
          <Link
            to="/login"
            className="bg-white border border-[#E5E5EA] text-[#1C1C1E] px-7 py-3 rounded-xl font-medium text-sm hover:border-[#4F8EF7]/50 transition-colors"
          >
            Já tenho conta
          </Link>
        </div>

        {/* App mockup placeholder */}
        <div className="mt-14 bg-white rounded-2xl border border-[#E5E5EA] shadow-xl shadow-black/5 overflow-hidden max-w-2xl mx-auto">
          <div className="bg-[#F9F9F9] border-b border-[#E5E5EA] px-4 py-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#FF3B30]/40" />
              <div className="w-3 h-3 rounded-full bg-[#FF9500]/40" />
              <div className="w-3 h-3 rounded-full bg-[#34C759]/40" />
            </div>
            <div className="flex-1 bg-[#E5E5EA] rounded-md h-5 mx-8" />
          </div>
          <div className="p-6 space-y-3">
            {[
              { label: "☀️ Reunião com cliente", time: "09:00", done: false, urgent: true },
              { label: "📊 Revisar relatório mensal", time: "10:30", done: true, urgent: false },
              { label: "📞 Ligar para fornecedor", time: "14:00", done: false, urgent: false },
              { label: "✍️ Preparar apresentação", time: "15:30", done: false, urgent: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={[
                    "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center",
                    item.done
                      ? "border-[#34C759] bg-[#34C759]"
                      : "border-[#AEAEB2]",
                  ].join(" ")}
                >
                  {item.done && <span className="text-white text-[9px] font-bold">✓</span>}
                </div>
                <span
                  className={[
                    "flex-1 text-sm",
                    item.done ? "line-through text-[#8E8E93]" : "text-[#1C1C1E]",
                  ].join(" ")}
                >
                  {item.label}
                </span>
                {item.urgent && (
                  <span className="text-[10px] bg-[#FF3B30]/10 text-[#FF3B30] px-2 py-0.5 rounded-full font-medium">
                    urgente
                  </span>
                )}
                <span className="text-xs text-[#8E8E93]">{item.time}</span>
              </div>
            ))}
            <div className="flex items-center gap-3 opacity-40 pt-1">
              <div className="w-5 h-5 rounded-full border-2 border-dashed border-[#AEAEB2] shrink-0" />
              <span className="text-sm text-[#8E8E93]">Nova tarefa…</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-2xl font-bold text-[#1C1C1E] text-center mb-2">Tudo que você precisa</h2>
        <p className="text-[#8E8E93] text-center mb-10 text-sm">
          Simples o suficiente para usar todo dia. Completo o suficiente para qualquer projeto.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-[#E5E5EA] rounded-2xl p-5 hover:border-[#4F8EF7]/30 hover:shadow-sm transition-all"
            >
              <span className="text-2xl block mb-3">{f.icon}</span>
              <h3 className="text-sm font-semibold text-[#1C1C1E] mb-1.5">{f.title}</h3>
              <p className="text-xs text-[#8E8E93] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-2xl font-bold text-[#1C1C1E] text-center mb-2">Planos simples</h2>
        <p className="text-[#8E8E93] text-center mb-10 text-sm">
          Comece grátis. Faça upgrade quando precisar de mais.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-2xl border ${plan.color} p-6 flex flex-col relative`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#4F8EF7] text-white text-[10px] font-bold px-3 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}
              <div className="mb-5">
                <h3 className="text-base font-semibold text-[#1C1C1E]">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-[#1C1C1E]">{plan.price}</span>
                  <span className="text-sm text-[#8E8E93]">/{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#1C1C1E]">
                    <span className="text-[#34C759] text-xs shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className={`text-sm font-medium py-2.5 rounded-xl text-center transition-colors ${plan.ctaStyle}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E5E5EA] mt-8">
        <div className="max-w-5xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/lc-logo.png" alt="LC" className="w-6 h-6 object-contain" />
            <span className="text-sm font-semibold text-[#1C1C1E]">
              <span className="text-[#4F8EF7]">LC</span>Tarefas
            </span>
          </div>
          <p className="text-xs text-[#8E8E93]">
            © {new Date().getFullYear()} LCTarefas. Feito com foco e intenção.
          </p>
          <Link to="/login" className="text-xs text-[#4F8EF7] hover:underline">
            Entrar no app →
          </Link>
        </div>
      </footer>
    </div>
  );
}
