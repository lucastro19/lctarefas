import { NavLink, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useTaskStore } from "../../store/taskStore";
import { useAreaStore } from "../../store/areaStore";
import { useAuthStore } from "../../store/authStore";
import { SettingsModal } from "../settings/SettingsModal";
import { useTagStore } from "../../store/tagStore";
import { useUiStore } from "../../store/uiStore";
import { usePlanLimits } from "../../hooks/usePlanLimits";
import { useCollaboratorStore } from "../../store/collaboratorStore";
import { useOrgStore } from "../../store/orgStore";
import { useNavPins } from "../../hooks/useNavPins";
import { CollaboratorModal } from "../delegation/CollaboratorModal";
import { CollaboratorAvatar, isFollowUpDue } from "../delegation/shared";

function norm(s) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function Accordion({ label, count, open, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] md:text-xs font-bold uppercase tracking-widest text-text-secondary/70"
      >
        <span className={["transition-transform inline-block text-[9px]", open ? "rotate-90" : ""].join(" ")}>▸</span>
        <span className="flex-1 text-left">{label}</span>
        {count > 0 && <span className="text-[10px] font-bold tabular-nums">{count}</span>}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function PinButton({ pinned, onClick, className = "" }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      title={pinned ? "Desafixar" : "Fixar"}
      className={[
        "shrink-0 text-xs transition-opacity",
        pinned ? "opacity-100 text-warning" : "opacity-0 group-hover:opacity-60 hover:!opacity-100 text-text-secondary",
        className,
      ].join(" ")}
    >
      {pinned ? "★" : "☆"}
    </button>
  );
}

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

const COCKPIT_ITEM = { to: "/cockpit", icon: "🧭", label: "Cockpit" };

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
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState({ tags: false, spaces: false, areas: true, team: false });
  const { areas, createArea, createProject, getProjectsByArea } = useAreaStore();
  const { tags } = useTagStore();
  const { getInbox, getToday, getUpcoming, getSomeday, getTrash, getDelegated, getFollowUpsDue, getDelegatedBy } = useTaskStore();
  const { collaborators } = useCollaboratorStore();
  const { organization, spaces } = useOrgStore();
  const { user, signOut } = useAuthStore();
  const { closeDrawer } = useUiStore();
  const navigate = useNavigate();
  const { canAddArea } = usePlanLimits();
  const { pins, isPinned, togglePin } = useNavPins();

  const handleAddArea = async (e) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    await createArea(newAreaName.trim());
    setNewAreaName("");
    setAddingArea(false);
  };

  const toggleSection = (key) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  // Busca filtra Tags/Espaços/Áreas/Equipe por nome — enquanto digita, as seções mostram o
  // resultado independente de estarem recolhidas ou não (ver `isOpen` de cada Accordion abaixo).
  const q = norm(search);
  const searching = q.length > 0;
  const filteredTags = tags.filter((t) => !searching || norm(t.name).includes(q));
  const filteredSpaces = spaces.filter((s) => !searching || norm(s.name).includes(q));
  const filteredAreas = areas.filter((a) =>
    !searching || norm(a.name).includes(q) || getProjectsByArea(a.id).some((p) => norm(p.name).includes(q))
  );
  const filteredCollaborators = collaborators.filter((c) => !searching || norm(c.name).includes(q));

  return (
    <aside className={className}>
      {/* Cabeçalho: usuário (marca + toggle agora vivem no NavRail) */}
      <div className="border-b border-border shrink-0">
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
        {(organization
          ? [...NAV_ITEMS.slice(0, 5), COCKPIT_ITEM, ...NAV_ITEMS.slice(5)]
          : NAV_ITEMS
        ).map((item) => {
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

        {/* Busca — filtra Tags/Espaços/Áreas/Equipe abaixo, ignorando o recolhido/aberto */}
        <div className="px-2 pb-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar área, tag, pessoa…"
            className="w-full text-[13px] bg-card border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary text-text-main placeholder:text-text-secondary/50"
          />
        </div>

        {/* Fixados (Fase 4.2) — guardado por usuário, sem tabela nova */}
        {pins.length > 0 && (
          <>
            <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-text-secondary/70 px-3 pt-2 pb-1">
              📌 Fixados
            </p>
            {pins.map((p) => (
              <NavLink
                key={`${p.type}-${p.id}`}
                to={p.to}
                onClick={closeDrawer}
                className={({ isActive }) => ["sidebar-item", isActive ? "active" : ""].join(" ")}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color ?? "#8E8E93" }} />
                <span className="flex-1 truncate">{p.label}</span>
              </NavLink>
            ))}
            <div className="h-px bg-border mx-2 my-2" />
          </>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <>
            <Accordion label="Tags" count={filteredTags.length} open={openSections.tags || searching} onToggle={() => toggleSection("tags")}>
              {filteredTags.map((tag) => (
                <div key={tag.id} className="relative flex items-center group">
                  <NavLink
                    to={`/tag/${tag.id}`}
                    onClick={closeDrawer}
                    className={({ isActive }) => ["sidebar-item flex-1 min-w-0", isActive ? "active" : ""].join(" ")}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="flex-1 truncate">{tag.name}</span>
                  </NavLink>
                  <PinButton
                    pinned={isPinned("tag", tag.id)}
                    onClick={() => togglePin("tag", tag.id, { label: tag.name, color: tag.color, to: `/tag/${tag.id}` })}
                    className="mr-2"
                  />
                </div>
              ))}
            </Accordion>
            <div className="h-px bg-border mx-2 my-2" />
          </>
        )}

        {/* Espaços da organização (Fase 3) — contêiner compartilhado, distinto das áreas pessoais */}
        {organization && spaces.length > 0 && (
          <>
            <Accordion label="Espaços" count={filteredSpaces.length} open={openSections.spaces || searching} onToggle={() => toggleSection("spaces")}>
              {filteredSpaces.map((space) => (
                <div key={space.id} className="relative flex items-center group">
                  <NavLink
                    to={`/espaco/${space.id}`}
                    onClick={closeDrawer}
                    className={({ isActive }) => ["sidebar-item flex-1 min-w-0", isActive ? "active" : ""].join(" ")}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: space.color }} />
                    <span className="flex-1 truncate">{space.name}</span>
                    {!space.is_open && <span className="text-text-secondary/50 text-xs shrink-0" title="Fechado">🔒</span>}
                  </NavLink>
                  <PinButton
                    pinned={isPinned("space", space.id)}
                    onClick={() => togglePin("space", space.id, { label: space.name, color: space.color, to: `/espaco/${space.id}` })}
                    className="mr-2"
                  />
                </div>
              ))}
            </Accordion>
            <div className="h-px bg-border mx-2 my-2" />
          </>
        )}

        {/* Areas & Projects */}
        <Accordion label="Áreas" count={filteredAreas.length} open={openSections.areas || searching} onToggle={() => toggleSection("areas")}>
          {filteredAreas.map((area) => (
            <AreaGroup
              key={area.id}
              area={area}
              projects={getProjectsByArea(area.id)}
              onAddProject={createProject}
              navigate={navigate}
              isPinned={isPinned}
              togglePin={togglePin}
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
        </Accordion>

        {/* Equipe — arraste uma tarefa até a pessoa para delegar */}
        <div className="h-px bg-border mx-2 my-2" />
        <Accordion label="Equipe" count={filteredCollaborators.length} open={openSections.team || searching} onToggle={() => toggleSection("team")}>
          {filteredCollaborators.map((c) => (
            <CollaboratorItem
              key={c.id}
              collaborator={c}
              pending={getDelegatedBy(c.id)}
              onNavigate={closeDrawer}
              isPinned={isPinned}
              togglePin={togglePin}
            />
          ))}

          <button
            onClick={() => { navigate("/organizacao"); closeDrawer(); }}
            className="sidebar-item w-full text-text-secondary hover:text-primary"
          >
            <span className="text-base w-5 text-center">👥</span>
            <span>Gerenciar equipe</span>
          </button>
        </Accordion>
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
    </aside>
  );
}

function CollaboratorItem({ collaborator, pending, onNavigate, isPinned, togglePin }) {
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
            {
              label: isPinned("collaborator", collaborator.id) ? "★ Desafixar" : "☆ Fixar",
              action: () => togglePin("collaborator", collaborator.id, {
                label: collaborator.name, color: collaborator.color, to: `/colaborador/${collaborator.id}`,
              }),
            },
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

function AreaGroup({ area, projects, onAddProject, navigate, isPinned, togglePin }) {
  const [open, setOpen] = useState(true);
  const [addingProject, setAddingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(area.name);
  const { archiveArea, deleteArea, updateArea } = useAreaStore();
  const { organization } = useOrgStore();

  const commitRename = async () => {
    if (renameDraft.trim() && renameDraft.trim() !== area.name)
      await updateArea(area.id, { name: renameDraft.trim() });
    setRenaming(false);
  };
  const { setNodeRef: areaDropRef, isOver: isOverArea } = useDroppable({ id: `area-${area.id}` });
  const linkedToOrg = organization && area.org_id === organization.id;

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
            {
              label: isPinned("area", area.id) ? "★ Desafixar" : "☆ Fixar",
              action: () => togglePin("area", area.id, { label: area.name, color: area.color, to: `/area/${area.id}` }),
            },
            { label: "Renomear", action: () => { setRenameDraft(area.name); setRenaming(true); } },
            { label: "Novo projeto", action: () => setAddingProject(true) },
            ...(organization ? [{
              label: linkedToOrg ? "Desvincular da organização" : "Vincular à organização",
              action: () => updateArea(area.id, { org_id: linkedToOrg ? null : organization.id }),
            }] : []),
            { label: "Arquivar área", action: () => { archiveArea(area.id); navigate("/inbox"); } },
            { label: "Mover para lixeira", danger: true, action: () => { deleteArea(area.id); navigate("/inbox"); } },
          ]}
        />
      )}

      {open && (
        <div className="ml-4 space-y-0.5">
          {projects.map((p) => (
            <ProjectItem key={p.id} project={p} navigate={navigate} isPinned={isPinned} togglePin={togglePin} />
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

function ProjectItem({ project, navigate, isPinned, togglePin }) {
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(project.name);
  const { archiveProject, deleteProject, updateProject } = useAreaStore();
  const { organization } = useOrgStore();

  const commitRename = async () => {
    if (renameDraft.trim() && renameDraft.trim() !== project.name)
      await updateProject(project.id, { name: renameDraft.trim() });
    setRenaming(false);
  };
  const { setNodeRef: projectDropRef, isOver: isOverProject } = useDroppable({ id: `project-${project.id}` });
  const linkedToOrg = organization && project.org_id === organization.id;
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
            {
              label: isPinned("project", project.id) ? "★ Desafixar" : "☆ Fixar",
              action: () => togglePin("project", project.id, { label: project.name, color: project.color, to: `/project/${project.id}` }),
            },
            { label: "Renomear", action: () => { setRenameDraft(project.name); setRenaming(true); } },
            ...(organization ? [{
              label: linkedToOrg ? "Desvincular da organização" : "Vincular à organização",
              action: () => updateProject(project.id, { org_id: linkedToOrg ? null : organization.id }),
            }] : []),
            { label: "Arquivar projeto", action: () => { archiveProject(project.id); navigate("/inbox"); } },
            { label: "Mover para lixeira", danger: true, action: () => { deleteProject(project.id); navigate("/inbox"); } },
          ]}
        />
      )}
    </div>
  );
}
