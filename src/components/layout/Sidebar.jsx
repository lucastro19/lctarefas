import { NavLink, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useTaskStore } from "../../store/taskStore";
import { useAreaStore } from "../../store/areaStore";
import { useAuthStore } from "../../store/authStore";
import { Badge } from "../ui/Badge";
import { SettingsModal } from "../settings/SettingsModal";
import { useTagStore } from "../../store/tagStore";
import { useUiStore } from "../../store/uiStore";
import { usePlanLimits } from "../../hooks/usePlanLimits";
import { useCollaboratorStore } from "../../store/collaboratorStore";
import { CollaboratorModal } from "../delegation/CollaboratorModal";
import { CollaboratorAvatar, isFollowUpDue } from "../delegation/shared";

const NAV_ITEMS = [
  { to: "/inbox", icon: "📥", label: "Inbox", dropId: "inbox" },
  { to: "/today", icon: "☀️", label: "Hoje", dropId: "today" },
  { to: "/upcoming", icon: "⏰", label: "Em Breve", dropId: "upcoming" },
  { to: "/someday", icon: "🔮", label: "Depois", dropId: "someday" },
  { to: "/delegadas", icon: "🤝", label: "Delegadas" },
  { to: "/calendar", icon: "📅", label: "Calendário" },
  { to: "/logbook", icon: "📋", label: "Histórico" },
  { to: "/booking-settings", icon: "🗓️", label: "Agendamento" },
  { to: "/trash", icon: "🗑️", label: "Lixeira" },
  { to: "/archive", icon: "📦", label: "Arquivo" },
];

function NavItem({ to, icon, label, count, urgentCount = 0, dropId, onNavigate }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId ?? `nav-${to}`, disabled: !dropId });
  return (
    <div ref={setNodeRef} className={["rounded-lg transition-colors", isOver ? "ring-2 ring-primary bg-primary/5" : ""].join(" ")}>
      <NavLink
        to={to}
        onClick={onNavigate}
        className={({ isActive }) =>
          ["sidebar-item", isActive ? "active" : ""].join(" ")
        }
      >
        <span className="text-lg md:text-base w-6 md:w-5 text-center shrink-0">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {count > 0 && (
          <span className={[
            "text-[11px] font-bold tabular-nums rounded-full px-1.5 min-w-[22px] text-center leading-5 shrink-0",
            urgentCount > 0
              ? "bg-danger text-white"
              : "bg-[#8E8E93]/30 text-[#3C3C43] dark:bg-white/12 dark:text-white/65",
          ].join(" ")}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </NavLink>
    </div>
  );
}

export function Sidebar({ className = "hidden md:flex w-56 bg-sidebar border-r border-border flex-col shrink-0 h-full" }) {
  const [newAreaName, setNewAreaName] = useState("");
  const [addingArea, setAddingArea] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewCollab, setShowNewCollab] = useState(false);
  const { areas, createArea, createProject, getProjectsByArea } = useAreaStore();
  const { tags } = useTagStore();
  const { getInbox, getToday, getUpcoming, getSomeday, getTrash, getDelegated, getFollowUpsDue, getDelegatedBy } = useTaskStore();
  const { collaborators } = useCollaboratorStore();
  const { user, signOut } = useAuthStore();
  const { closeDrawer, toggleFocusMode } = useUiStore();
  const navigate = useNavigate();
  const { canAddArea, canAddProject, canAddCollaborator, isPro } = usePlanLimits();

  const handleAddArea = async (e) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    await createArea(newAreaName.trim());
    setNewAreaName("");
    setAddingArea(false);
  };

  return (
    <aside className={className}>
      {/* Cabeçalho: marca + usuário */}
      <div className="border-b border-border shrink-0">
        {/* Linha da marca */}
        <div className="px-4 pt-5 pb-3 flex items-center gap-3">
          <img src="/lc-logo.png" alt="LC" className="w-9 h-9 shrink-0 object-contain" />
          <div className="leading-none">
            <span className="font-bold text-base text-[#2563EB]">LC</span>
            <span className="font-semibold text-base text-text-main">Tarefas</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={toggleFocusMode}
            title="Ocultar barra lateral"
            className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-main hover:bg-bg transition-colors shrink-0"
          >
            {/* sidebar toggle icon (macOS style) */}
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <rect x="0.6" y="0.6" width="16.8" height="12.8" rx="2.4" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="6" y1="0.6" x2="6" y2="13.4" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="2" y1="4.5" x2="4.5" y2="4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="2" y1="7" x2="4.5" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="2" y1="9.5" x2="4.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Divisor */}
        <div className="mx-4 border-t border-border" />

        {/* Linha do usuário */}
        <div className="px-4 py-3 flex items-center gap-3">
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              className="w-10 h-10 md:w-8 md:h-8 rounded-full shrink-0 ring-2 ring-border"
              alt=""
            />
          ) : (
            <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-base font-bold shrink-0">
              {(user?.user_metadata?.full_name ?? user?.email ?? "?")[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] md:text-sm font-semibold text-text-main truncate leading-tight">
              {user?.user_metadata?.full_name ?? "Usuário"}
            </p>
            <p className="text-xs md:text-[11px] text-text-secondary truncate leading-tight mt-0.5">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 md:space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const todayTasks = getToday();
          const counts = {
            "/inbox": getInbox().length,
            "/today": todayTasks.length,
            "/upcoming": getUpcoming().length,
            "/someday": getSomeday().length,
            "/delegadas": getDelegated().length,
            "/trash": getTrash().length,
          };
          const urgentCounts = {
            "/today": todayTasks.filter((t) => t.is_urgent).length,
            // Badge vermelho quando há cobrança vencida
            "/delegadas": getFollowUpsDue().length,
          };
          return (
            <NavItem
              key={item.to}
              {...item}
              count={counts[item.to]}
              urgentCount={urgentCounts[item.to] ?? 0}
              onNavigate={closeDrawer}
            />
          );
        })}

        {/* Separator */}
        <div className="h-px bg-border mx-2 my-2" />

        {/* Tags */}
        {tags.length > 0 && (
          <>
            <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-text-secondary/70 px-3 pt-2 pb-1">
              Tags
            </p>
            {tags.map((tag) => (
              <NavLink
                key={tag.id}
                to={`/tag/${tag.id}`}
                onClick={closeDrawer}
                className={({ isActive }) => ["sidebar-item", isActive ? "active" : ""].join(" ")}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="flex-1 truncate">{tag.name}</span>
              </NavLink>
            ))}
            <div className="h-px bg-border mx-2 my-2" />
          </>
        )}

        {/* Areas & Projects */}
        <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-text-secondary/70 px-3 pt-2 pb-1">
          Áreas
        </p>

        {areas.map((area) => (
          <AreaGroup
            key={area.id}
            area={area}
            projects={getProjectsByArea(area.id)}
            onAddProject={createProject}
            navigate={navigate}
          />
        ))}

        {/* Add Area */}
        {addingArea ? (
          <form onSubmit={handleAddArea} className="px-3 py-1">
            <input
              autoFocus
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              onBlur={() => { if (!newAreaName.trim()) setAddingArea(false); }}
              placeholder="Nome da área"
              className="w-full text-sm bg-card border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main"
            />
          </form>
        ) : canAddArea ? (
          <button
            onClick={() => setAddingArea(true)}
            className="sidebar-item w-full text-text-secondary hover:text-primary"
          >
            <span className="text-base w-5 text-center">+</span>
            <span>Nova área</span>
          </button>
        ) : (
          <div className="px-3 py-1.5">
            <p className="text-[10px] text-warning">
              Limite de áreas atingido.{" "}
              <button onClick={() => setShowSettings(true)} className="underline hover:text-primary transition-colors">
                Ver Pro
              </button>
            </p>
          </div>
        )}

        {/* Equipe — arraste uma tarefa até a pessoa para delegar */}
        <div className="h-px bg-border mx-2 my-2" />
        <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-text-secondary/70 px-3 pt-2 pb-1">
          Equipe
        </p>

        {collaborators.map((c) => (
          <CollaboratorItem
            key={c.id}
            collaborator={c}
            pending={getDelegatedBy(c.id)}
            onNavigate={closeDrawer}
          />
        ))}

        {canAddCollaborator ? (
          <button
            onClick={() => setShowNewCollab(true)}
            className="sidebar-item w-full text-text-secondary hover:text-primary"
          >
            <span className="text-base w-5 text-center">+</span>
            <span>Novo colaborador</span>
          </button>
        ) : (
          <div className="px-3 py-1.5">
            <p className="text-[10px] text-warning">
              Limite de colaboradores atingido.{" "}
              <button onClick={() => setShowSettings(true)} className="underline hover:text-primary transition-colors">
                Ver Pro
              </button>
            </p>
          </div>
        )}
      </nav>

      {/* Atalhos rápidos */}
      <div className="px-3 pb-1 flex gap-1">
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
          className="flex-1 flex items-center gap-1.5 px-2 py-2 md:py-1.5 rounded-lg text-sm md:text-xs text-text-secondary hover:text-text-main hover:bg-card transition-all min-h-[44px] md:min-h-0"
        >
          <span>🔍</span> Buscar
          <kbd className="ml-auto text-[10px] border border-[#C7C7CC] rounded px-1 hidden md:inline">⌘K</kbd>
        </button>
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true }))}
          className="flex-1 flex items-center gap-1.5 px-2 py-2 md:py-1.5 rounded-lg text-sm md:text-xs text-text-secondary hover:text-text-main hover:bg-card transition-all min-h-[44px] md:min-h-0"
        >
          <span>✏️</span> Nova
          <kbd className="ml-auto text-[10px] border border-[#C7C7CC] rounded px-1 hidden md:inline">⌘N</kbd>
        </button>
      </div>

      {/* Rodapé: configurações + sair */}
      <div className="px-3 py-2 border-t border-border flex items-center gap-1">
        <button
          onClick={() => setShowSettings(true)}
          className="flex-1 flex items-center gap-1.5 px-2 py-2 md:py-1.5 rounded-lg text-sm md:text-xs text-text-secondary hover:text-text-main hover:bg-card transition-all min-h-[44px] md:min-h-0"
          title="Configurações"
        >
          <span>⚙️</span>
          <span>Configurações</span>
        </button>
        <button
          onClick={signOut}
          className="px-3 py-2 md:px-2 md:py-1.5 rounded-lg text-sm md:text-xs text-text-secondary hover:text-danger hover:bg-card transition-all min-h-[44px] md:min-h-0"
          title="Sair"
        >
          Sair
        </button>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showNewCollab && <CollaboratorModal onClose={() => setShowNewCollab(false)} />}
    </aside>
  );
}

function CollaboratorItem({ collaborator, pending, onNavigate }) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const { archiveCollaborator, deleteCollaborator } = useCollaboratorStore();
  const navigate = useNavigate();
  const { setNodeRef, isOver } = useDroppable({ id: `collab-${collaborator.id}` });

  const overdue = pending.filter(isFollowUpDue).length;

  return (
    <div
      ref={setNodeRef}
      className={["relative flex items-center group rounded-lg transition-colors", isOver ? "ring-2 ring-primary bg-primary/5" : ""].join(" ")}
    >
      <NavLink
        to={`/colaborador/${collaborator.id}`}
        onClick={onNavigate}
        className={({ isActive }) => ["sidebar-item flex-1 min-w-0", isActive ? "active" : ""].join(" ")}
      >
        <CollaboratorAvatar collaborator={collaborator} size={20} />
        <span className="flex-1 truncate">{collaborator.name}</span>
        {pending.length > 0 && (
          <span className={[
            "text-[11px] font-bold tabular-nums rounded-full px-1.5 min-w-[22px] text-center leading-5 shrink-0",
            overdue > 0
              ? "bg-danger text-white"
              : "bg-[#8E8E93]/30 text-[#3C3C43] dark:bg-white/12 dark:text-white/65",
          ].join(" ")}>
            {pending.length}
          </span>
        )}
      </NavLink>

      <button
        onClick={(e) => { e.preventDefault(); setShowMenu(!showMenu); }}
        className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-text-main px-1 py-1 rounded transition-opacity text-xs shrink-0"
      >
        ···
      </button>

      {showMenu && (
        <ContextMenu
          onClose={() => setShowMenu(false)}
          items={[
            { label: "Editar", action: () => setEditing(true) },
            { label: "Ver pendências", action: () => navigate(`/colaborador/${collaborator.id}`) },
            { label: "Arquivar", action: () => { archiveCollaborator(collaborator.id); navigate("/delegadas"); } },
            { label: "Mover para lixeira", danger: true, action: () => { deleteCollaborator(collaborator.id); navigate("/delegadas"); } },
          ]}
        />
      )}

      {editing && <CollaboratorModal collaborator={collaborator} onClose={() => setEditing(false)} />}
    </div>
  );
}

function ContextMenu({ items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-md z-50 py-1 min-w-[140px]"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose(); }}
          className={["w-full text-left px-3 py-2 text-xs hover:bg-[#EBEBF0] dark:hover:bg-[#3A3A3C] transition-colors", item.danger ? "text-danger" : "text-[#1C1C1E] dark:text-[#F2F2F7]"].join(" ")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function AreaGroup({ area, projects, onAddProject, navigate }) {
  const [open, setOpen] = useState(true);
  const [addingProject, setAddingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(area.name);
  const { archiveArea, deleteArea, updateArea } = useAreaStore();

  const commitRename = async () => {
    if (renameDraft.trim() && renameDraft.trim() !== area.name)
      await updateArea(area.id, { name: renameDraft.trim() });
    setRenaming(false);
  };
  const { setNodeRef: areaDropRef, isOver: isOverArea } = useDroppable({ id: `area-${area.id}` });

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    const p = await onAddProject(area.id, projectName.trim());
    setProjectName("");
    setAddingProject(false);
    if (p) navigate(`/project/${p.id}`);
  };

  return (
    <div className="relative">
      <div className={["flex items-center group rounded-lg transition-colors", isOverArea ? "ring-2 ring-primary bg-primary/5" : ""].join(" ")}>
        <div ref={areaDropRef} className="flex-1 min-w-0">
        <NavLink
          to={`/area/${area.id}`}
          className={({ isActive }) =>
            ["sidebar-item flex-1 min-w-0", isActive ? "active" : ""].join(" ")
          }
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
          {renaming ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
              onClick={(e) => e.preventDefault()}
              className="flex-1 text-sm font-medium bg-transparent outline-none border-b border-primary text-text-main"
            />
          ) : (
            <span className="flex-1 truncate font-medium">{area.name}</span>
          )}
        </NavLink>
        </div>

        <div className="flex items-center shrink-0 pr-1 gap-0.5">
          <button
            onClick={(e) => { e.preventDefault(); setShowMenu(!showMenu); }}
            className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-text-main px-1 py-1 rounded transition-opacity text-xs"
          >
            ···
          </button>
          <button
            onClick={(e) => { e.preventDefault(); setOpen(!open); }}
            className="text-text-secondary hover:text-text-main px-1 text-xs"
          >
            {open ? "▾" : "▸"}
          </button>
        </div>
      </div>

      {showMenu && (
        <ContextMenu
          onClose={() => setShowMenu(false)}
          items={[
            { label: "Renomear", action: () => { setRenameDraft(area.name); setRenaming(true); } },
            { label: "Novo projeto", action: () => setAddingProject(true) },
            { label: "Arquivar área", action: () => { archiveArea(area.id); navigate("/inbox"); } },
            { label: "Mover para lixeira", danger: true, action: () => { deleteArea(area.id); navigate("/inbox"); } },
          ]}
        />
      )}

      {open && (
        <div className="ml-4 space-y-0.5">
          {projects.map((p) => (
            <ProjectItem key={p.id} project={p} navigate={navigate} />
          ))}

          {addingProject ? (
            <form onSubmit={handleAddProject} className="px-2 py-1">
              <input
                autoFocus
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={() => { if (!projectName.trim()) setAddingProject(false); }}
                placeholder="Nome do projeto"
                className="w-full text-xs bg-card border border-border rounded px-2 py-1 outline-none focus:border-primary text-text-main"
              />
            </form>
          ) : (
            <button
              onClick={() => setAddingProject(true)}
              className="sidebar-item w-full text-sm text-text-secondary hover:text-primary"
            >
              <span>+ Projeto</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectItem({ project, navigate }) {
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(project.name);
  const { archiveProject, deleteProject, updateProject } = useAreaStore();

  const commitRename = async () => {
    if (renameDraft.trim() && renameDraft.trim() !== project.name)
      await updateProject(project.id, { name: renameDraft.trim() });
    setRenaming(false);
  };
  const { setNodeRef: projectDropRef, isOver: isOverProject } = useDroppable({ id: `project-${project.id}` });
  const { getByProject, getCompletedByProject } = useTaskStore();
  const active = getByProject(project.id).length;
  const done = getCompletedByProject(project.id).length;
  const total = active + done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div ref={projectDropRef} className={["relative flex items-center group rounded-lg transition-colors", isOverProject ? "ring-2 ring-primary bg-primary/5" : ""].join(" ")}>
      <NavLink
        to={`/project/${project.id}`}
        className={({ isActive }) =>
          ["sidebar-item text-sm flex-1 min-w-0", isActive ? "active" : ""].join(" ")
        }
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <span className="flex-1 truncate min-w-0">
          {renaming ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
              onClick={(e) => e.preventDefault()}
              className="w-full text-xs bg-transparent outline-none border-b border-primary text-text-main"
            />
          ) : (
            <span className="block truncate">{project.name}</span>
          )}
          {total > 0 && (
            <span className="block mt-0.5 h-0.5 rounded-full bg-border overflow-hidden">
              <span
                className="block h-full rounded-full bg-success transition-all"
                style={{ width: `${pct}%` }}
              />
            </span>
          )}
        </span>
      </NavLink>

      <button
        onClick={(e) => { e.preventDefault(); setShowMenu(!showMenu); }}
        className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-text-main pr-1 text-xs transition-opacity"
      >
        ···
      </button>

      {showMenu && (
        <ContextMenu
          onClose={() => setShowMenu(false)}
          items={[
            { label: "Renomear", action: () => { setRenameDraft(project.name); setRenaming(true); } },
            { label: "Arquivar projeto", action: () => { archiveProject(project.id); navigate("/inbox"); } },
            { label: "Mover para lixeira", danger: true, action: () => { deleteProject(project.id); navigate("/inbox"); } },
          ]}
        />
      )}
    </div>
  );
}
