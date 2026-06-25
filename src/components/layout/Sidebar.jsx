import { NavLink, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useTaskStore } from "../../store/taskStore";
import { useAreaStore } from "../../store/areaStore";
import { useAuthStore } from "../../store/authStore";
import { Badge } from "../ui/Badge";
import { SettingsModal } from "../settings/SettingsModal";
import { useTagStore } from "../../store/tagStore";

const NAV_ITEMS = [
  { to: "/inbox", icon: "📥", label: "Inbox", dropId: "inbox" },
  { to: "/today", icon: "☀️", label: "Hoje", dropId: "today" },
  { to: "/upcoming", icon: "⏰", label: "Em Breve" },
  { to: "/someday", icon: "🔮", label: "Algum Dia", dropId: "someday" },
  { to: "/logbook", icon: "📋", label: "Histórico" },
  { to: "/trash", icon: "🗑️", label: "Lixeira" },
  { to: "/archive", icon: "📦", label: "Arquivo" },
];

function NavItem({ to, icon, label, count, dropId }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId ?? `nav-${to}`, disabled: !dropId });
  return (
    <div ref={setNodeRef} className={["rounded-lg transition-colors", isOver ? "ring-2 ring-primary bg-primary/5" : ""].join(" ")}>
      <NavLink
        to={to}
        className={({ isActive }) =>
          ["sidebar-item", isActive ? "active" : ""].join(" ")
        }
      >
        <span className="text-base w-5 text-center">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        <Badge count={count} />
      </NavLink>
    </div>
  );
}

export function Sidebar() {
  const [newAreaName, setNewAreaName] = useState("");
  const [addingArea, setAddingArea] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { areas, createArea, createProject, getProjectsByArea } = useAreaStore();
  const { tags } = useTagStore();
  const { getInbox, getToday, getUpcoming, getSomeday, getTrash } = useTaskStore();
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleAddArea = async (e) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    await createArea(newAreaName.trim());
    setNewAreaName("");
    setAddingArea(false);
  };

  return (
    <aside className="w-56 bg-sidebar border-r border-border flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">LC</span>
          </div>
          <span className="font-semibold text-sm text-text-main">LCTarefas</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const counts = {
            "/inbox": getInbox().length,
            "/today": getToday().length,
            "/upcoming": getUpcoming().length,
            "/someday": getSomeday().length,
            "/trash": getTrash().length,
          };
          return <NavItem key={item.to} {...item} count={counts[item.to]} />;
        })}

        {/* Separator */}
        <div className="h-px bg-border mx-2 my-2" />

        {/* Tags */}
        {tags.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary px-3 pt-1 pb-1">
              Tags
            </p>
            {tags.map((tag) => (
              <NavLink
                key={tag.id}
                to={`/tag/${tag.id}`}
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
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary px-3 pt-1 pb-2">
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
        ) : (
          <button
            onClick={() => setAddingArea(true)}
            className="sidebar-item w-full text-text-secondary hover:text-primary"
          >
            <span className="text-base w-5 text-center">+</span>
            <span>Nova área</span>
          </button>
        )}
      </nav>

      {/* Atalhos rápidos */}
      <div className="px-3 pb-1 flex gap-1">
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
          className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-main hover:bg-card transition-all"
        >
          <span>🔍</span> Buscar
          <kbd className="ml-auto text-[10px] border border-[#C7C7CC] rounded px-1">⌘K</kbd>
        </button>
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true }))}
          className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-main hover:bg-card transition-all"
        >
          <span>✏️</span> Nova
          <kbd className="ml-auto text-[10px] border border-[#C7C7CC] rounded px-1">⌘N</kbd>
        </button>
      </div>

      {/* User + Settings */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-1">
          <button
            onClick={signOut}
            className="flex items-center gap-2 flex-1 px-2 py-1.5 rounded-lg hover:bg-card transition-all group min-w-0"
          >
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-6 h-6 rounded-full shrink-0" alt="" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                {user?.email?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-xs text-text-secondary truncate flex-1 text-left">
              {user?.user_metadata?.full_name ?? user?.email}
            </span>
            <span className="text-text-secondary text-xs opacity-0 group-hover:opacity-100 shrink-0">Sair</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg hover:bg-card text-text-secondary hover:text-text-main transition-all shrink-0"
            title="Configurações"
          >
            ⚙️
          </button>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </aside>
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
  const { archiveArea, deleteArea } = useAreaStore();
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
          <span className="flex-1 truncate font-medium">{area.name}</span>
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
              className="sidebar-item w-full text-xs text-text-secondary hover:text-primary"
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
  const { archiveProject, deleteProject } = useAreaStore();
  const { setNodeRef: projectDropRef, isOver: isOverProject } = useDroppable({ id: `project-${project.id}` });

  return (
    <div ref={projectDropRef} className={["relative flex items-center group rounded-lg transition-colors", isOverProject ? "ring-2 ring-primary bg-primary/5" : ""].join(" ")}>
      <NavLink
        to={`/project/${project.id}`}
        className={({ isActive }) =>
          ["sidebar-item text-xs flex-1 min-w-0", isActive ? "active" : ""].join(" ")
        }
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <span className="flex-1 truncate">{project.name}</span>
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
            { label: "Arquivar projeto", action: () => { archiveProject(project.id); navigate("/inbox"); } },
            { label: "Mover para lixeira", danger: true, action: () => { deleteProject(project.id); navigate("/inbox"); } },
          ]}
        />
      )}
    </div>
  );
}
