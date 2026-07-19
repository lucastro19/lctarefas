import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { useTaskStore } from "../store/taskStore";
import { useAreaStore } from "../store/areaStore";
import { TaskDetail } from "../components/tasks/TaskDetail";

/* ─── Helpers ─────────────────────────────────────────────── */
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addDays(d, n) {
  const r = new Date(d + "T12:00:00"); r.setDate(r.getDate() + n); return localDateStr(r);
}
function mondayOf(d) {
  const r = new Date(d + "T12:00:00"), day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day)); return localDateStr(r);
}
function timeToMinutes(t) { if (!t) return null; const [h,m]=t.split(":").map(Number); return h*60+m; }
function minutesToTime(min) { return `${String(Math.floor(min/60)).padStart(2,"0")}:${String(min%60).padStart(2,"0")}`; }
function snapQ(min) { return Math.round(min/15)*15; }
function fmtFull(d)  { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"}); }
function fmtWeekday(d){ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long"}); }
function fmtMonthYear(d){ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"}).toLowerCase(); }
function fmtYear(d){ return String(new Date(d+"T12:00:00").getFullYear()); }

/* Converte hex #rrggbb → rgba(r,g,b,a) */
function hexRgba(hex, a) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return `rgba(52,199,89,${a})`;
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ─── Constantes ─────────────────────────────────────────── */
const HOUR_HEIGHT  = 72;   // px por hora
const MIN_EV_H     = 22;   // altura mínima visível (não inflacionar para não sobrepor)
const GRID_START_H = 6;
const GRID_END_H   = 23;
const gridHours    = Array.from({length: GRID_END_H-GRID_START_H}, (_,i)=>GRID_START_H+i);
const MAX_COLS     = 2;

const VIEWS = [
  {id:"list",  label:"Lista",  shortcut:"L", mobileHide:false},
  {id:"day",   label:"Dia",    shortcut:"D", mobileHide:false},
  {id:"week",  label:"Semana", shortcut:"S", mobileHide:true},
  {id:"month", label:"Mês",    shortcut:"M", mobileHide:false},
  {id:"year",  label:"Ano",    shortcut:"A", mobileHide:false},
];

const PT_MONTHS   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const PT_WEEKDAYS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const PT_WD_SHORT = ["dom","seg","ter","qua","qui","sex","sáb"];

function getDays(view, anchor) {
  if (view==="day")      return [anchor];
  if (view==="3day")     return [0,1,2].map(n=>addDays(anchor,n));
  if (view==="workweek") return [0,1,2,3,4].map(n=>addDays(mondayOf(anchor),n));
  if (view==="week")     return [0,1,2,3,4,5,6].map(n=>addDays(mondayOf(anchor),n));
  return [];
}

function navigate(view, anchor, dir) {
  if (view==="month") {
    const d=new Date(anchor+"T12:00:00"); d.setMonth(d.getMonth()+dir); return localDateStr(d);
  }
  if (view==="year") {
    const d=new Date(anchor+"T12:00:00"); d.setFullYear(d.getFullYear()+dir); return localDateStr(d);
  }
  if (view==="list") return addDays(anchor, dir*7);
  return addDays(anchor, dir*({day:1,"3day":3,workweek:7,week:7}[view]??1));
}

/* ─── Layout de eventos com total por evento (não global) ─── */
function layoutEvents(tasks) {
  const sorted = [...tasks].sort((a,b)=>(timeToMinutes(a.scheduled_time)??0)-(timeToMinutes(b.scheduled_time)??0));
  const cols = [];
  const placed = [];
  const hiddenByMinute = {};

  for (const task of sorted) {
    const s = timeToMinutes(task.scheduled_time) ?? (GRID_START_H*60);
    const e = s + (task.duration_minutes ?? 30);
    let col = cols.findIndex(end => end <= s);
    if (col === -1) {
      if (cols.length >= MAX_COLS) {
        const key = String(s);
        (hiddenByMinute[key] ?? (hiddenByMinute[key] = [])).push(task);
        continue;
      }
      col = cols.length;
      cols.push(e);
    } else {
      cols[col] = e;
    }
    placed.push({task, col, s, e});
  }

  // Total por evento = quantas colunas estão ocupadas durante o intervalo desse evento
  // (evita que tarefas sozinhas fiquem com 50% de largura por causa de um overlap anterior)
  const events = placed.map(item => {
    const concurrent = placed.filter(o => o.s < item.e && o.e > item.s);
    const total = Math.max(...concurrent.map(o => o.col + 1), 1);
    return {task: item.task, col: item.col, total};
  });

  return {events, hiddenByMinute};
}

/* ─── Ícones SVG ────────────────────────────────────────── */
function ChevronLeft(){
  return <svg width="6" height="11" viewBox="0 0 6 11" fill="none" aria-hidden>
    <path d="M5 1L1 5.5L5 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
function ChevronRight(){
  return <svg width="6" height="11" viewBox="0 0 6 11" fill="none" aria-hidden>
    <path d="M1 1L5 5.5L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

/* ─── Círculo de evento ──────────────────────────────────── */
function EventCircle({done, urgent, color, size=12}){
  const borderColor = done ? "#636366" : urgent ? "#FF3B30" : (color ?? "#34C759");
  const bgColor     = done ? "#636366" : "transparent";
  return (
    <span className="inline-flex items-center justify-center rounded-full border-2 shrink-0"
      style={{width:size, height:size, borderColor, backgroundColor:bgColor}}>
      {done && <svg width="6" height="4" viewBox="0 0 6 4" fill="none">
        <path d="M1 2L2.2 3L5 1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>}
    </span>
  );
}

/* ─── Conteúdo de evento na timeline ────────────────────── */
function EventContent({task, height, onToggle, areaColor}){
  const done   = !!task.completed_at;
  const urgent = task.is_urgent && !done;
  const accentColor = done ? "#8E8E93" : urgent ? "#FF453A" : (areaColor ?? "#34C759");
  const bg          = done ? "rgba(142,142,147,0.10)" : hexRgba(accentColor, urgent ? 0.14 : 0.13);
  const borderL     = done ? "rgba(142,142,147,0.35)" : hexRgba(accentColor, urgent ? 0.90 : 0.80);

  const startMin = timeToMinutes(task.scheduled_time);
  const endMin   = startMin !== null ? startMin + (task.duration_minutes ?? 30) : null;
  const timeRange = startMin !== null
    ? `${task.scheduled_time.slice(0,5)} – ${minutesToTime(endMin)}`
    : null;

  // Modo compacto quando o bloco for muito pequeno para duas linhas
  const compact = height < 44;

  return (
    <div className="w-full h-full flex gap-1.5 overflow-hidden"
      style={{
        backgroundColor: bg,
        borderLeft: `3px solid ${borderL}`,
        borderRadius: "0 5px 5px 0",
        padding: compact ? "2px 6px" : "5px 7px",
        alignItems: compact ? "center" : "flex-start",
      }}>
      <button
        onPointerDown={e=>e.stopPropagation()}
        onClick={e=>{e.stopPropagation();e.preventDefault();onToggle?.(task);}}
        className="shrink-0 transition-opacity hover:opacity-70"
        style={{marginTop: compact ? 0 : 1}}
      >
        <EventCircle done={done} urgent={urgent} color={accentColor} size={compact ? 11 : 13}/>
      </button>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold leading-tight truncate ${done?"line-through":""}`}
          style={{
            fontSize: compact ? 11 : 12.5,
            color: done ? "var(--cal-done-text)" : accentColor,
          }}>
          {task.title || "Sem título"}
        </p>
        {!compact && timeRange && (
          <p className="text-[10.5px] mt-0.5 leading-none tabular-nums font-medium"
            style={{color: done ? "var(--cal-done-text)" : hexRgba(accentColor, 0.70)}}>
            {timeRange}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Evento arrastável ──────────────────────────────────── */
function DraggableEvent({task, col, total, onSelect, onToggle, areaColor}){
  const start  = timeToMinutes(task.scheduled_time)??(GRID_START_H*60);
  const dur    = task.duration_minutes??30;
  const top    = ((start-GRID_START_H*60)/60)*HOUR_HEIGHT;
  const height = Math.max(MIN_EV_H, (dur/60)*HOUR_HEIGHT);
  const w      = `${100/total}%`;
  const left   = `${(col/total)*100}%`;

  const {attributes,listeners,setNodeRef,transform,isDragging} = useDraggable({id:task.id, data:{task}});

  return (
    <div
      ref={setNodeRef}
      data-task-id={task.id}
      style={{
        position:"absolute", top, left, width:w, height,
        // O elemento SE MOVE com a transform — sem overlay duplicado
        transform: transform?`translate3d(${transform.x}px,${transform.y}px,0)`:undefined,
        opacity: isDragging ? 0.85 : 1,
        zIndex: isDragging ? 50 : 2,
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.35)" : "none",
        touchAction:"none",
        paddingLeft: col>0?2:0,
        paddingRight: col<total-1?2:0,
        cursor: isDragging ? "grabbing" : "grab",
        transition: isDragging ? "none" : "opacity 0.15s, box-shadow 0.15s",
      }}
      {...attributes} {...listeners}
      onClick={e=>{if(!isDragging){e.stopPropagation();onSelect(task);}}}
    >
      <EventContent task={task} height={height} onToggle={onToggle} areaColor={areaColor}/>
    </div>
  );
}

/* ─── Coluna droppable ───────────────────────────────────── */
function DayCol({dateStr, isToday, children, onDoubleClick}){
  const {setNodeRef, isOver} = useDroppable({id:dateStr});
  return (
    <div
      ref={setNodeRef}
      onDoubleClick={e=>onDoubleClick(e,dateStr)}
      className="flex-1 relative border-l border-border/[0.18] min-w-0 transition-colors"
      style={{
        minWidth:0,
        backgroundColor: isOver?"rgba(79,142,247,0.07)":isToday?"var(--cal-bg-today)":"transparent",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Faixa de tarefas sem horário ───────────────────────── */
function AllDayRow({days, tasksByDay, onTaskSelect}){
  const rows = days.map(d=>(tasksByDay[d]??[]).filter(t=>!t.scheduled_time&&!t.completed_at));
  const hasAny = rows.some(r=>r.length>0);
  if(!hasAny) return null;
  return (
    <div className="flex shrink-0" style={{borderBottom:`1px solid var(--cal-line)`, minHeight:28}}>
      <div className="w-14 shrink-0 flex items-center justify-end pr-2">
        <span className="text-[9px] font-medium select-none uppercase tracking-wide leading-tight text-right"
          style={{color:"var(--cal-text-dimmer)"}}>sem<br/>hora</span>
      </div>
      {days.map((dateStr, i)=>(
        <div key={dateStr} className="flex-1 min-w-0 flex flex-wrap gap-0.5 px-0.5 py-0.5"
          style={{borderLeft:`1px solid var(--cal-line)`}}>
          {rows[i].slice(0,3).map(t=>(
            <button key={t.id}
              onClick={e=>{e.stopPropagation();onTaskSelect(t);}}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] max-w-full"
              style={{backgroundColor:"rgba(52,199,89,0.12)",color:"rgba(52,199,89,0.85)",border:"1px solid rgba(52,199,89,0.22)"}}>
              <span className="truncate max-w-[80px]">{t.title||"Sem título"}</span>
            </button>
          ))}
          {rows[i].length>3 && (
            <span className="text-[9px] self-center px-0.5" style={{color:"var(--cal-text-dimmer)"}}>
              +{rows[i].length-3}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Modal de tarefas ocultas ───────────────────────────── */
function OverflowModal({tasks, onClose, onSelect, areaColors}){
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/40"/>
      <div className="relative w-full max-w-sm bg-card border border-border rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden"
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-text-main">Mais tarefas</p>
          <button onClick={onClose} className="text-text-secondary hover:text-text-main text-lg leading-none">×</button>
        </div>
        <div className="overflow-y-auto max-h-60 divide-y divide-border/50">
          {tasks.map(t=>{
            const done=!!t.completed_at, urgent=t.is_urgent&&!done;
            const areaColor = t.area_id ? areaColors[t.area_id] : null;
            const accentColor = done?"#8E8E93":urgent?"#FF453A":(areaColor??"#34C759");
            return (
              <button key={t.id}
                onClick={()=>{onSelect(t);onClose();}}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg/60 text-left transition-colors">
                <EventCircle done={done} urgent={urgent} color={accentColor} size={14}/>
                {t.scheduled_time&&(
                  <span className="text-xs tabular-nums font-semibold shrink-0"
                    style={{color:done?"var(--cal-done-text)":accentColor}}>
                    {t.scheduled_time.slice(0,5)}
                  </span>
                )}
                <span className={["text-sm font-medium flex-1 truncate",
                  done?"line-through text-text-secondary/40":"text-text-main"].join(" ")}>
                  {t.title||"Sem título"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Timeline ───────────────────────────────────────────── */
function TimeGrid({days, tasksByDay, today, onTaskSelect, onTaskToggle, onDoubleClick, gridRef, areaColors}){
  const now = new Date();
  const nowMin = now.getHours()*60+now.getMinutes();
  const [overflowTasks, setOverflowTasks] = useState(null);

  return (
    <>
      <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{scrollbarWidth:"thin"}}>
        <div style={{height:gridHours.length*HOUR_HEIGHT, width:"100%", position:"relative"}} className="flex">

          {/* Horas */}
          <div className="w-14 shrink-0 relative z-10" style={{background:"inherit"}}>
            {gridHours.map(h=>(
              <div key={h} style={{position:"absolute",top:(h-GRID_START_H)*HOUR_HEIGHT,right:0,left:0}}
                className="flex justify-end pr-3">
                <span className="text-[11.5px] font-medium tabular-nums leading-none -mt-[7px] select-none"
                  style={{color:"var(--cal-hour-txt)"}}>
                  {String(h).padStart(2,"0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Colunas de dias */}
          {days.map(dateStr=>{
            const isToday = dateStr===today;
            const timedTasks = (tasksByDay[dateStr]??[]).filter(t=>t.scheduled_time);
            const {events: laid, hiddenByMinute} = layoutEvents(timedTasks);

            return (
              <DayCol key={dateStr} dateStr={dateStr} isToday={isToday} onDoubleClick={onDoubleClick}>
                {/* Linhas de grade */}
                {gridHours.flatMap(h=>[
                  <div key={`h${h}`} style={{position:"absolute",top:(h-GRID_START_H)*HOUR_HEIGHT,left:0,right:0,
                    borderTop:`1px solid var(--cal-line)`}}/>,
                  <div key={`hh${h}`} style={{position:"absolute",top:(h-GRID_START_H)*HOUR_HEIGHT+HOUR_HEIGHT/2,left:0,right:0,
                    borderTop:`1px dashed var(--cal-line-dash)`}}/>,
                ])}

                {/* Eventos visíveis */}
                {laid.map(({task,col,total})=>{
                  const areaColor = task.area_id ? areaColors[task.area_id] : null;
                  return (
                    <DraggableEvent key={task.id} task={task} col={col} total={total}
                      onSelect={onTaskSelect} onToggle={onTaskToggle} areaColor={areaColor}/>
                  );
                })}

                {/* Chips de overflow — clicáveis */}
                {Object.entries(hiddenByMinute).map(([minStr, hiddenList])=>{
                  const min = Number(minStr);
                  const topPx = ((min-GRID_START_H*60)/60)*HOUR_HEIGHT;
                  return (
                    <button key={minStr}
                      onClick={e=>{e.stopPropagation();setOverflowTasks(hiddenList);}}
                      className="text-[10px] font-bold px-1.5 py-1 rounded-md leading-none active:opacity-70"
                      style={{
                        position:"absolute", top:topPx+4, right:4, zIndex:6,
                        backgroundColor:"var(--cal-ctrl-bg)",
                        color:"var(--cal-text-dim)",
                        border:"1px solid var(--cal-border)",
                      }}>
                      +{hiddenList.length}
                    </button>
                  );
                })}
              </DayCol>
            );
          })}

          {/* Linha "agora" */}
          {days.includes(today) && nowMin>=GRID_START_H*60 && nowMin<GRID_END_H*60 && (
            <div style={{position:"absolute",top:((nowMin-GRID_START_H*60)/60)*HOUR_HEIGHT,left:56,right:0,zIndex:20,pointerEvents:"none"}}
              className="flex items-center">
              <div className="shrink-0 rounded-full -ml-[3px]"
                style={{width:7,height:7,backgroundColor:"#FF3B30",boxShadow:"0 0 5px rgba(255,59,48,0.6)"}}/>
              <div className="flex-1" style={{borderTop:"1px solid rgba(255,59,48,0.55)"}}/>
            </div>
          )}
        </div>
      </div>

      {overflowTasks && (
        <OverflowModal
          tasks={overflowTasks}
          onClose={()=>setOverflowTasks(null)}
          onSelect={onTaskSelect}
          areaColors={areaColors}
        />
      )}
    </>
  );
}

/* ─── Cabeçalho de dias ──────────────────────────────────── */
function DayHeaders({days, today}){
  const DAY_NAMES = ["dom","seg","ter","qua","qui","sex","sáb"];
  return (
    <div className="flex shrink-0" style={{borderBottom:`1px solid var(--cal-line)`}}>
      <div className="w-14 shrink-0"/>
      {days.map(dateStr=>{
        const d = new Date(dateStr+"T12:00:00");
        const isToday   = dateStr===today;
        const isWeekend = d.getDay()===0||d.getDay()===6;
        const dayName   = `${DAY_NAMES[d.getDay()]}.`;
        const dayNum    = d.getDate();
        return (
          <div key={dateStr}
            className="flex-1 flex flex-col items-center justify-center py-2 min-w-0 gap-0.5"
            style={{borderLeft:`1px solid var(--cal-line-dash)`}}>
            <span className="text-[10.5px] select-none leading-none"
              style={{fontWeight:500,color:isToday?"rgba(91,156,246,0.80)":isWeekend?"var(--cal-wknd)":"var(--cal-text-dim)"}}>
              {dayName}
            </span>
            {isToday ? (
              <span className="flex items-center justify-center rounded-full select-none"
                style={{width:28,height:28,backgroundColor:"#4F8EF7",color:"#fff",fontSize:14,fontWeight:700,lineHeight:1}}>
                {dayNum}
              </span>
            ) : (
              <span className="select-none"
                style={{fontSize:14,fontWeight:500,lineHeight:1,color:isWeekend?"var(--cal-wknd)":"var(--cal-text-dim)"}}>
                {dayNum}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Linha de tarefa na Lista ───────────────────────────── */
function AgendaTaskRow({task, onSelect, areaColor}){
  const done   = !!task.completed_at;
  const urgent = task.is_urgent && !done;
  const accent = done?"#8E8E93":urgent?"#FF453A":(areaColor??"#34C759");
  return (
    <button
      type="button"
      onPointerDown={e=>e.stopPropagation()}
      onClick={e=>{e.stopPropagation();onSelect(task);}}
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg/60 active:bg-bg/60 transition-colors text-left">
      <EventCircle done={done} urgent={urgent} color={accent} size={14}/>
      {task.scheduled_time && (
        <span className="text-xs font-semibold tabular-nums shrink-0 w-10"
          style={{color:done?"var(--cal-done-text)":accent}}>
          {task.scheduled_time.slice(0,5)}
        </span>
      )}
      <span className={["text-sm font-medium flex-1 truncate",
        done?"line-through text-text-secondary/35":urgent?"text-danger":"text-text-main"].join(" ")}>
        {task.title || "Sem título"}
      </span>
      {urgent && !done && (
        <span className="shrink-0 text-[10px] font-bold text-danger">!</span>
      )}
    </button>
  );
}

/* ─── Visão Lista (Agenda) ───────────────────────────────── */
function AgendaView({tasksByDay, today, onTaskSelect, areaColors}){
  const NEAR  = 7;
  const TOTAL = 90;

  const sortTasks = ts => [...ts].sort((a,b)=>{
    const at=a.scheduled_time??"99:99", bt=b.scheduled_time??"99:99";
    return at<bt?-1:at>bt?1:0;
  });

  const nearDates = Array.from({length:NEAR}, (_,i)=>addDays(today,i));
  const farDates  = Array.from({length:TOTAL-NEAR}, (_,i)=>addDays(today,i+NEAR));

  const farByMonth = {};
  farDates.forEach(d=>{ const mk=d.slice(0,7); (farByMonth[mk]??=[]).push(d); });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 pt-3 pb-10">

        {nearDates.map((dateStr,idx)=>{
          const d       = new Date(dateStr+"T12:00:00");
          const isToday = dateStr===today;
          const dayNum  = d.getDate();
          const wdLabel = isToday?"Hoje":idx===1?"Amanhã":PT_WEEKDAYS[d.getDay()];
          const tasks   = sortTasks(tasksByDay[dateStr]??[]);
          return (
            <div key={dateStr} className={isToday?"mb-6":"mb-4"}>
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className={["font-bold leading-none tabular-nums",
                  isToday?"text-primary text-[34px]":"text-[28px] text-text-main"].join(" ")}>
                  {dayNum}
                </span>
                <span className={["font-medium",
                  isToday?"text-[17px] text-primary/80":"text-[15px] text-text-secondary"].join(" ")}>
                  {wdLabel}
                </span>
                {tasks.length===0 && <span className="text-xs text-text-secondary/30 ml-1">—</span>}
              </div>
              {tasks.length>0 && (
                <div className="rounded-xl overflow-hidden bg-card border border-border">
                  {tasks.map((t,i)=>{
                    const areaColor = t.area_id ? areaColors[t.area_id] : null;
                    return (
                      <div key={t.id} className={i>0?"border-t border-border/50":""}>
                        <AgendaTaskRow task={t} onSelect={onTaskSelect} areaColor={areaColor}/>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="my-5 border-t border-border/30"/>

        {Object.entries(farByMonth).map(([mk, dates])=>{
          const datesWithTasks = dates.filter(d=>(tasksByDay[d]??[]).length>0);
          if(datesWithTasks.length===0) return null;
          const mDate = new Date(mk+"-01T12:00:00");
          return (
            <div key={mk} className="mb-6">
              <p className="text-base font-semibold text-text-main mb-2">{PT_MONTHS[mDate.getMonth()]}</p>
              <div className="rounded-xl overflow-hidden bg-card border border-border">
                {datesWithTasks.map((dateStr,i)=>{
                  const d     = new Date(dateStr+"T12:00:00");
                  const tasks = sortTasks(tasksByDay[dateStr]??[]);
                  return (
                    <div key={dateStr} className={i>0?"border-t border-border/50":""}>
                      <div className="flex items-center gap-2 px-3 pt-2.5 pb-0.5">
                        <span className="text-xs font-semibold text-text-secondary/60">{d.getDate()}</span>
                        <span className="text-xs text-text-secondary/40">{PT_WD_SHORT[d.getDay()]}.</span>
                      </div>
                      {tasks.map(t=>{
                        const areaColor = t.area_id ? areaColors[t.area_id] : null;
                        return (
                          <AgendaTaskRow key={t.id} task={t} onSelect={onTaskSelect} areaColor={areaColor}/>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Visão Mês ──────────────────────────────────────────── */
const MONTH_SHORT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function MonthView({anchor, tasksByDay, today, onDaySelect, onTaskSelect}){
  const ref = new Date(anchor+"T12:00:00");
  const year=ref.getFullYear(), month=ref.getMonth();

  const first=new Date(year,month,1);
  const skip = first.getDay();
  const start=new Date(first); start.setDate(1-skip);

  const weeks=[];
  const cur=new Date(start);
  for(let w=0;w<6;w++){
    const week=[];
    for(let d=0;d<7;d++){week.push(localDateStr(cur));cur.setDate(cur.getDate()+1);}
    weeks.push(week);
    if(w>=4&&new Date(week[6]+"T12:00:00").getMonth()!==month) break;
  }

  const DN=["dom.","seg.","ter.","qua.","qui.","sex.","sáb."];

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="grid grid-cols-7 shrink-0" style={{borderBottom:`1px solid var(--cal-line)`}}>
        {DN.map((d,i)=>(
          <div key={d} className="text-center py-2.5 text-[11px] font-medium select-none tracking-wider uppercase"
            style={{color:i===0||i===6?"var(--cal-wknd)":"var(--cal-text-dimmer)"}}>
            {d}
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden"
        style={{display:"grid",gridTemplateRows:`repeat(${weeks.length},1fr)`}}>
        {weeks.map((week,wi)=>(
          <div key={wi} className="min-h-0" style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
            {week.map(dateStr=>{
              const d      = new Date(dateStr+"T12:00:00");
              const dayNum = d.getDate();
              const dayMonth = d.getMonth();
              const inMonth= dayMonth===month;
              const isToday= dateStr===today;
              const isWknd = d.getDay()===0||d.getDay()===6;
              const isFirstOfMonth = dayNum===1;
              const dayLabel = isFirstOfMonth ? `1 de ${MONTH_SHORT[dayMonth]}.` : String(dayNum);

              const allTasks = (tasksByDay[dateStr]??[]).slice().sort((a,b)=>{
                const ad=a.completed_at?1:0, bd=b.completed_at?1:0;
                if(ad!==bd) return ad-bd;
                return (a.scheduled_time??"")<(b.scheduled_time??"")?-1:1;
              });
              const MAX=4, visible=allTasks.slice(0,MAX), overflow=allTasks.length-MAX;

              return (
                <div key={dateStr}
                  onClick={()=>onDaySelect(dateStr)}
                  className="flex flex-col min-h-0 overflow-hidden cursor-pointer transition-colors"
                  style={{
                    borderRight:`1px solid var(--cal-line)`,
                    borderBottom:`1px solid var(--cal-line)`,
                    backgroundColor:isToday?"var(--cal-bg-today)":"transparent",
                  }}
                  onMouseEnter={e=>{ if(inMonth) e.currentTarget.style.backgroundColor=isToday?"rgba(79,142,247,0.07)":"var(--cal-bg-hover)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.backgroundColor=isToday?"var(--cal-bg-today)":"transparent"; }}>
                  <div className="pr-2 pt-1.5 pb-0.5 flex justify-end shrink-0">
                    <span className={["inline-flex items-center justify-center rounded-full leading-none px-1 font-medium",
                      isFirstOfMonth?"text-[10px] h-[22px] min-w-[22px]":"text-[12px] w-[22px] h-[22px]"].join(" ")}
                      style={{
                        backgroundColor:isToday?"#4F8EF7":"transparent",
                        color:isToday?"#fff":!inMonth?"var(--cal-text-dimmer)":isWknd?"var(--cal-wknd)":"var(--cal-text)",
                        fontWeight:isToday?700:500,
                      }}>
                      {dayLabel}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden px-0.5 pb-0.5 flex flex-col gap-[2px]">
                    {visible.map(t=>{
                      const done=!!t.completed_at, urgent=t.is_urgent&&!done;
                      const dotColor=done?"#636366":urgent?"#FF3B30":"#30D158";
                      return (
                        <button key={t.id}
                          onClick={e=>{e.stopPropagation();onTaskSelect(t);}}
                          className={["w-full flex items-center gap-1 text-left px-1 py-1 rounded transition-colors overflow-hidden shrink-0 min-h-[22px]",
                            !inMonth?"opacity-25":""].join(" ")}>
                          <span className="shrink-0 rounded-full border-2"
                            style={{width:10,height:10,borderColor:dotColor,backgroundColor:done?dotColor:"transparent",opacity:done?0.5:1,flexShrink:0}}/>
                          <span className={["flex-1 min-w-0 text-xs font-medium leading-snug truncate",
                            done?"line-through text-text-secondary/30":"text-text-main"].join(" ")}>
                            {t.title}
                          </span>
                          {t.scheduled_time&&(
                            <span className="shrink-0 text-[9.5px] tabular-nums text-text-secondary/50 ml-1 leading-none font-medium">
                              {t.scheduled_time.slice(0,5)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {overflow>0&&(
                      <p className="text-[10px] text-text-secondary/50 pl-2.5 leading-tight shrink-0 select-none py-0.5">
                        e mais {overflow}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Mini mês (Ano) ─────────────────────────────────────── */
function MiniMonthGrid({year, month, tasksByDay, today, onDayClick}){
  const first=new Date(year,month,1);
  const skip=first.getDay();
  const start=new Date(first); start.setDate(1-skip);
  const cells=[];
  const cur=new Date(start);
  for(let i=0;i<42;i++){
    cells.push({str:localDateStr(cur), d:cur.getDate(), inMonth:cur.getMonth()===month, wd:cur.getDay()});
    cur.setDate(cur.getDate()+1);
    if(i>=34&&cur.getMonth()!==month) break;
  }
  const DN2=["D","S","T","Q","Q","S","S"];
  return (
    <div>
      <p className="text-[11px] font-semibold mb-2 capitalize tracking-tight" style={{color:"var(--cal-text)"}}>{PT_MONTHS[month]}</p>
      <div className="grid grid-cols-7">
        {DN2.map((l,i)=>(
          <span key={i} className="text-center pb-1 text-[8px] font-medium select-none"
            style={{color:i===0||i===6?"var(--cal-wknd)":"var(--cal-text-dimmer)"}}>
            {l}
          </span>
        ))}
        {cells.map(({str,d,inMonth,wd})=>{
          const isToday=str===today, hasTasks=(tasksByDay[str]??[]).some(t=>!t.completed_at), isWknd=wd===0||wd===6;
          return (
            <button key={str} onClick={()=>onDayClick(str)}
              className="flex flex-col items-center pb-0.5 transition-opacity hover:opacity-80">
              <span className="w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] leading-none font-medium"
                style={{
                  backgroundColor:isToday?"#4F8EF7":"transparent",
                  color:isToday?"#fff":!inMonth?"var(--cal-text-dimmer)":isWknd?"var(--cal-wknd)":"var(--cal-text)",
                  fontWeight:isToday?700:400,
                }}>
                {d}
              </span>
              {hasTasks&&inMonth&&!isToday&&(
                <div className="w-[3px] h-[3px] rounded-full mt-[-1px]" style={{backgroundColor:"#4F8EF7",opacity:0.6}}/>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearView({anchor, tasksByDay, today, onDayClick}){
  const year=new Date(anchor+"T12:00:00").getFullYear();
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-7 md:gap-x-8 md:gap-y-8">
        {Array.from({length:12},(_,i)=>(
          <MiniMonthGrid key={i} year={year} month={i} tasksByDay={tasksByDay} today={today} onDayClick={onDayClick}/>
        ))}
      </div>
    </div>
  );
}

/* ─── Componente principal ───────────────────────────────── */
export function Calendar(){
  const {tasks, updateTask, completeTask, uncompleteTask, createTask} = useTaskStore();
  const {areas} = useAreaStore();
  const today = localDateStr();

  // Mapa de cor por área
  const areaColors = areas.reduce((acc,a)=>{ if(a.id&&a.color) acc[a.id]=a.color; return acc; },{});

  const [view,     setView]    = useState("list");
  const [anchor,   setAnchor]  = useState(today);
  const [selected, setSelected] = useState(null);
  const gridRef = useRef(null);

  const isTimeline = ["day","3day","workweek","week"].includes(view);
  const isList     = view === "list";
  const days       = isTimeline ? getDays(view, anchor) : [];

  const tasksByDay = tasks.reduce((acc,t)=>{
    if(!t.scheduled_date||t.deleted_at||t.archived_at) return acc;
    (acc[t.scheduled_date]??=[]).push(t); return acc;
  },{});

  const goBack    = useCallback(()=>setAnchor(a=>navigate(view,a,-1)),[view]);
  const goForward = useCallback(()=>setAnchor(a=>navigate(view,a, 1)),[view]);
  const goToday   = useCallback(()=>setAnchor(today),[today]);

  const handleToggle = useCallback(async t=>{
    if(t.completed_at) await uncompleteTask(t.id); else await completeTask(t.id);
  },[completeTask,uncompleteTask]);

  const handleDoubleClick = useCallback(async(e, dateStr)=>{
    if(e.target.closest("[data-task-id]")) return;
    const col = e.currentTarget;
    const rect = col.getBoundingClientRect();
    const yInCol = e.clientY - rect.top;
    const total = snapQ(GRID_START_H*60 + (yInCol/HOUR_HEIGHT)*60);
    const clamped = Math.max(GRID_START_H*60, Math.min((GRID_END_H-1)*60, total));
    const newTask = await createTask({scheduled_date:dateStr, scheduled_time:minutesToTime(clamped), title:""});
    if(newTask) setSelected(newTask);
  },[createTask]);

  /* Scroll inteligente: hora atual se for hoje, primeira tarefa do dia caso contrário */
  useEffect(()=>{
    if(!gridRef.current||!isTimeline) return;
    const now = new Date();
    let targetMin;
    if(anchor===today){
      targetMin = now.getHours()*60+now.getMinutes();
    } else {
      const dayTasks = (tasksByDay[anchor]??[]).filter(t=>t.scheduled_time);
      if(dayTasks.length>0){
        const earliest = Math.min(...dayTasks.map(t=>timeToMinutes(t.scheduled_time)));
        targetMin = earliest - 30; // mostrar 30min antes da primeira tarefa
      } else {
        targetMin = 8*60; // padrão: 08:00
      }
    }
    const offset = ((targetMin-GRID_START_H*60)/60)*HOUR_HEIGHT - 80;
    gridRef.current.scrollTop = Math.max(0, offset);
  },[view, anchor]);

  /* Swipe mobile */
  const swipeStartX = useRef(null);
  const onTouchStart = useCallback(e=>{ swipeStartX.current = e.touches[0].clientX; },[]);
  const onTouchEnd   = useCallback(e=>{
    if(swipeStartX.current===null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    swipeStartX.current = null;
    if(Math.abs(dx)>52) dx<0 ? goForward() : goBack();
  },[goBack,goForward]);

  /* DnD */
  const sensors = useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}));
  const onDragEnd = async ({active,over,delta})=>{
    if(!over||!active.data.current) return;
    const task=active.data.current.task;
    const orig=timeToMinutes(task.scheduled_time)??(GRID_START_H*60);
    const snapped=snapQ(orig+(delta.y/HOUR_HEIGHT)*60);
    const clamped=Math.max(GRID_START_H*60,Math.min((GRID_END_H-1)*60,snapped));
    const newDate=over.id, newTime=minutesToTime(clamped);
    if(newDate!==task.scheduled_date||newTime!==task.scheduled_time){
      const updated = await updateTask(task.id,{scheduled_date:newDate,scheduled_time:newTime});
      if(updated && selected?.id===task.id) setSelected(updated);
    }
  };

  /* Atalhos */
  useEffect(()=>{
    const h=e=>{
      const el=e.target;
      if(el.tagName==="INPUT"||el.tagName==="TEXTAREA"||el.isContentEditable) return;
      if(e.key==="Escape"&&selected){setSelected(null);return;}
      const k=e.key.toLowerCase();
      if(k==="l"){setView("list");return;}
      if(k==="d"||k==="1"){setView("day");return;}
      if(k==="3"){setView("3day");return;}
      if(k==="u"){setView("workweek");return;}
      if(k==="s"||k==="7"){setView("week");return;}
      if(k==="m"){setView("month");return;}
      if(k==="a"){setView("year");return;}
      if(k==="t"){goToday();return;}
      if(k==="arrowleft"||k==="k"){goBack();return;}
      if(k==="arrowright"||k==="j"){goForward();return;}
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[goBack,goForward,goToday,selected]);

  const headerTitle = isList?"Agenda":view==="day"?fmtFull(anchor):view==="year"?fmtYear(anchor):fmtMonthYear(anchor);
  const headerSub   = !isList&&view==="day"?fmtWeekday(anchor):null;
  const onDaySelect = (dateStr)=>{ setAnchor(dateStr); setView("day"); };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="flex h-full overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden px-3 pt-4 pb-2 md:px-5">

          {/* Header */}
          <div className="shrink-0 mb-3">

            {/* Linha 1: switcher (esq) + < Hoje > (dir) */}
            <div className="flex items-center mb-3">
              {/* View switcher — botões soltos com separadores */}
              <div className="flex items-center">
                {VIEWS.map((v, i) => {
                  const active = v.id===view||(v.id==="day"&&["3day","workweek"].includes(view));
                  return (
                    <div key={v.id} className={["flex items-center", v.mobileHide?"hidden md:flex":""].join(" ")}>
                      {i > 0 && (
                        <span className={["w-px h-3.5 shrink-0 mx-1", v.mobileHide?"hidden md:block":""].join(" ")}
                          style={{backgroundColor:"var(--cal-ctrl-border)"}}/>
                      )}
                      <button onClick={()=>setView(v.id)}
                        className={[
                          "text-[14px] md:text-[12px] px-2.5 md:px-2 py-1.5 rounded-lg transition-all font-medium whitespace-nowrap",
                          active ? "text-text-main" : "text-text-secondary hover:text-text-main",
                        ].join(" ")}
                        style={{backgroundColor:active?"var(--cal-ctrl-btn-act)":"transparent"}}>
                        {v.label}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex-1"/>

              {/* Navegação: < Hoje > — canto superior direito */}
              {!isList && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={goBack}
                    className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-full transition-colors text-text-secondary hover:text-text-main hover:bg-card">
                    <ChevronLeft/>
                  </button>
                  <button onClick={goToday}
                    className="text-[13px] md:text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all text-text-secondary hover:text-text-main whitespace-nowrap"
                    style={{border:"1px solid var(--cal-ctrl-border)"}}>
                    Hoje
                  </button>
                  <button onClick={goForward}
                    className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-full transition-colors text-text-secondary hover:text-text-main hover:bg-card">
                    <ChevronRight/>
                  </button>
                </div>
              )}
            </div>

            {/* Linha 2: data grande no canto esquerdo */}
            {isList ? (
              <h1 className="text-[26px] font-bold text-text-main">Agenda</h1>
            ) : (
              <div>
                <h1 className="text-[26px] md:text-[30px] font-bold text-text-main capitalize leading-tight">
                  {headerTitle}
                </h1>
                {headerSub && (
                  <p className="text-[14px] capitalize text-text-secondary mt-0.5 leading-none">
                    {headerSub}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Conteúdo */}
          {isList ? (
            <AgendaView tasksByDay={tasksByDay} today={today} onTaskSelect={setSelected} areaColors={areaColors}/>
          ) : isTimeline ? (
            <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden"
              style={{border:`1px solid var(--cal-border)`}}>
              <DayHeaders days={days} today={today}/>
              <AllDayRow days={days} tasksByDay={tasksByDay} onTaskSelect={setSelected}/>
              <TimeGrid days={days} tasksByDay={tasksByDay} today={today}
                onTaskSelect={setSelected} onTaskToggle={handleToggle}
                onDoubleClick={handleDoubleClick} gridRef={gridRef} areaColors={areaColors}/>
              {view==="day" && (
                <>
                  <p className="hidden md:block text-[9px] text-center py-1.5 shrink-0 select-none"
                    style={{color:"var(--cal-text-dimmer)"}}>
                    Duplo clique para criar · Arrastar para mover
                  </p>
                  <p className="md:hidden text-[9px] text-center py-1.5 shrink-0 select-none"
                    style={{color:"var(--cal-text-dimmer)"}}>
                    Deslize ← → para navegar
                  </p>
                </>
              )}
            </div>
          ) : view==="month" ? (
            <div className="flex-1 min-h-0 rounded-xl overflow-hidden"
              style={{border:`1px solid var(--cal-border)`}}>
              <MonthView anchor={anchor} tasksByDay={tasksByDay} today={today}
                onDaySelect={onDaySelect} onTaskSelect={setSelected}/>
            </div>
          ) : (
            <div className="flex-1 min-h-0 rounded-xl overflow-hidden"
              style={{border:`1px solid var(--cal-border)`}}>
              <YearView anchor={anchor} tasksByDay={tasksByDay} today={today} onDayClick={onDaySelect}/>
            </div>
          )}
        </div>

        {selected && (
          <div onClick={e=>e.stopPropagation()}>
            <TaskDetail key={selected.id} task={selected} onClose={()=>setSelected(null)}/>
          </div>
        )}
      </div>

    </DndContext>
  );
}
