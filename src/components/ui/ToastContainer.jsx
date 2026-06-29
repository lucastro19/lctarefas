import { useUiStore } from "../../store/uiStore";

export function ToastContainer() {
  const { toasts, dismissToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 bg-[#1C1C1E] dark:bg-[#F2F2F7] text-white dark:text-[#1C1C1E] text-sm px-4 py-3 rounded-2xl shadow-xl animate-toast-in"
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.onAction?.();
                dismissToast(toast.id);
              }}
              className="text-primary dark:text-primary font-semibold ml-1 hover:opacity-80 transition-opacity"
            >
              {toast.action}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
