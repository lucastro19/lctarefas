import { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { useSelectionStore } from "./store/selectionStore";
import { useSettingsStore, applyTheme } from "./store/settingsStore";
import { useUiStore } from "./store/uiStore";
import { useTaskStore } from "./store/taskStore";
import { useAreaStore } from "./store/areaStore";
import { useTagStore } from "./store/tagStore";
import { Layout } from "./components/layout/Layout";
import { Login } from "./pages/Login";
// Páginas críticas (carregadas imediatamente)
import { Inbox } from "./pages/Inbox";
import { Today } from "./pages/Today";
import { Upcoming } from "./pages/Upcoming";
import { Someday } from "./pages/Someday";
// Páginas secundárias (lazy — carregadas só quando o usuário navegar)
const Trash      = lazy(() => import("./pages/Trash").then((m) => ({ default: m.Trash })));
const AreaPage   = lazy(() => import("./pages/AreaPage").then((m) => ({ default: m.AreaPage })));
const ProjectPage= lazy(() => import("./pages/ProjectPage").then((m) => ({ default: m.ProjectPage })));
const Archive    = lazy(() => import("./pages/Archive").then((m) => ({ default: m.Archive })));
const Logbook    = lazy(() => import("./pages/Logbook").then((m) => ({ default: m.Logbook })));
const TagPage    = lazy(() => import("./pages/TagPage").then((m) => ({ default: m.TagPage })));
const Calendar   = lazy(() => import("./pages/Calendar").then((m) => ({ default: m.Calendar })));
import { SearchModal } from "./components/search/SearchModal";
import { QuickEntry } from "./components/quickentry/QuickEntry";
import { ToastContainer } from "./components/ui/ToastContainer";
import { requestNotificationPermission, scheduleTaskNotifications } from "./services/notifications";

function PageSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#FF9500] text-white text-xs font-medium text-center py-1.5 px-4">
      Sem conexão — dados podem estar desatualizados
    </div>
  );
}

function AppRoutes() {
  const { user, loading, init } = useAuthStore();
  const { tasks, fetchTasks, subscribeRealtime, unsubscribeRealtime, drainQueue } = useTaskStore();
  const { fetchAll } = useAreaStore();
  const { fetchTags, fetchAllTaskTags } = useTagStore();
  const { clearAll } = useSelectionStore();
  const { theme } = useSettingsStore();
  const location = useLocation();

  const { toggleFocusMode, showQuickEntry, closeQuickEntry, toggleQuickEntry, showSearch, openSearch, closeSearch } = useUiStore();

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("auto");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);
  useEffect(() => { clearAll(); }, [location.pathname]);
  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchAll();
      fetchTags();
      fetchAllTaskTags();
      requestNotificationPermission();
      // Realtime sync entre dispositivos
      const unsub = subscribeRealtime();
      return () => { if (unsub) unsub(); };
    }
  }, [user]);

  // Drena a fila offline quando a conexão volta
  useEffect(() => {
    const handleOnline = () => drainQueue();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // Reagenda notificações sempre que as tarefas mudam
  useEffect(() => {
    if (user && tasks.length > 0) scheduleTaskNotifications(tasks);
  }, [tasks, user]);

  // Listener: ações de notificação vindas do Service Worker (Concluir / Adiar)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const { completeTask, updateTask } = useTaskStore.getState();
    const handler = async (event) => {
      const { type, taskId, minutes } = event.data ?? {};
      if (!taskId) return;
      if (type === "COMPLETE_TASK") {
        await completeTask(taskId);
      }
      if (type === "SNOOZE_TASK" && minutes) {
        const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
        if (!task?.scheduled_time) return;
        const [h, m] = task.scheduled_time.split(":").map(Number);
        const newMin = h * 60 + m + minutes;
        const newH = Math.floor(newMin / 60) % 24;
        const newM = newMin % 60;
        const newTime = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
        await updateTask(taskId, { scheduled_time: newTime });
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  // Atalhos globais de teclado
  useEffect(() => {
    const handler = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "k") { e.preventDefault(); showSearch ? closeSearch() : openSearch(); }
      if (meta && e.key === "n") { e.preventDefault(); toggleQuickEntry(); }
      if (meta && e.shiftKey && e.key === "F") { e.preventDefault(); toggleFocusMode(); }
      if (e.key === "Escape") { closeSearch(); closeQuickEntry(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <>
      <Layout>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/today" element={<Today />} />
            <Route path="/upcoming" element={<Upcoming />} />
            <Route path="/someday" element={<Someday />} />
            <Route path="/trash" element={<Trash />} />
            <Route path="/area/:id" element={<AreaPage />} />
            <Route path="/project/:id" element={<ProjectPage />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/logbook" element={<Logbook />} />
            <Route path="/tag/:id" element={<TagPage />} />
            <Route path="/calendar" element={<Calendar />} />
          </Routes>
        </Suspense>
      </Layout>

      {showSearch && <SearchModal onClose={closeSearch} />}
      {showQuickEntry && <QuickEntry onClose={closeQuickEntry} />}
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <AppRoutes />
    </BrowserRouter>
  );
}
