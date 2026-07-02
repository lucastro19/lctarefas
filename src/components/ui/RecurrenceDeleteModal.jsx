import { createPortal } from "react-dom";

export function RecurrenceDeleteModal({ task, onDeleteThis, onDeleteFuture, onCancel }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl overflow-hidden shadow-2xl w-[320px]"
        style={{ backgroundColor: "rgba(44,44,46,0.98)", border: "1px solid rgba(255,255,255,0.10)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-6 pt-6 pb-4 text-center">
          <p className="text-[15px] font-semibold text-white leading-snug">
            Tem certeza de que deseja apagar este lembrete? Ele é recorrente.
          </p>
        </div>

        {/* Divisor */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }} />

        {/* Botões */}
        <button
          onClick={onDeleteThis}
          className="w-full px-6 py-3.5 text-[15px] font-normal text-white text-center transition-colors"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          Apagar Apenas Este Lembrete
        </button>

        <button
          onClick={onDeleteFuture}
          className="w-full px-6 py-3.5 text-[15px] font-normal text-white text-center transition-colors"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          Apagar Todos os Lembretes Futuros
        </button>

        <button
          onClick={onCancel}
          className="w-full px-6 py-3.5 text-[15px] font-medium text-white text-center transition-colors"
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          Cancelar
        </button>
      </div>
    </div>,
    document.body
  );
}
