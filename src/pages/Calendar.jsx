import { useState, useRef, useEffect, useCallback } from "react";
import {
  DndContext, DragOverlay,
  useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { useTaskStore } from "../store/taskStore";
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
function startOfMonth(d) {
  const r = new Date(d + "T12:00:00"); r.setDate(1); return localDateStr(r);
}
function timeToMinutes(t) { if (!t) return null; const [h,m]=t.split(":").map(Number); return h*60+m; }
function minutesToTime(min) { return `${String(Math.floor(min/60)).padStart(2,"0")}:${String(min%60).padStart(2,"0")}`; }
function snapQ(min) { return Math.round(min/15)*15; }
function fmtFull(d)  { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"}); }
function fmtWeekday(d){ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long"}); }
function fmtMonthYear(d){ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"}).toLowerCase(); }
function fmtYear(d){ return String(new Date(d+"T12:00:00").getFullYear()); }

/* ─── Constantes ─────────────────────────────────────────── */
const HOUR_HEIGHT = 52;
const GRID_START_H = 6;
const GRID_END_H   = 23;
const gridHours = Array.from({length: GRID_END_H-GRID_START_H}, (_,i)=>GRID_START_H+i);

const VIEWS = [
  {id:"day",   label:"Dia",    shortcut:"D"},
  {id:"week",  label:"Semana", shortcut:"S"},
  {id:"month", label:"Mês",    shortcut:"M"},
  {id:"year",  label:"Ano",    shortcut:"A"},
];

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
  return addDays(anchor, dir*({day:1,"3day":3,workweek:7,week:7}[view]??1));
}

/* ─── Layout de eventos sobrepostos ─────────────────────── */
function layoutEvents(tasks) {
  const sorted = [...tasks].sort((a,b)=>(timeToMinutes(a.scheduled_time)??0)-(timeToMinutes(b.scheduled_time)??0));
  const cols = []; // end time de cada coluna
  const result = sorted.map(task=>{
    const s = timeToMinutes(task.scheduled_time) ?? (GRID_START_H*60);
    const e = s + (task.duration_minutes ?? 30);
    let col = cols.findIndex(end => end <= s);
    if (col===-1){ col=cols.length; cols.push(e); } else cols[col]=e;
    return {task, col};
  });
  const total = cols.length || 1;
  return result.map(r=>({...r, total}));
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

/* ─── Mini componentes visuais ───────────────────────────── */
function EventCircle({done,urgent,size=12}){
  const cls = done ? "border-[#636366] bg-[#636366]" : urgent ? "border-danger bg-transparent" : "border-success bg-transparent";
  return (
    <span className={`inline-flex items-center justify-center rounded-full border-2 shrink-0 ${cls}`}
      style={{width:size, height:size}}>
      {done && <svg width="6" height="4" viewBox="0 0 6 4" fill="none">
        <path d="M1 2L2.2 3L5 1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>}
    </span>
  );
}

function LoadBar({minutes}){
  const pct = Math.min(100,(minutes/(8*60))*100);
  if(!pct) return null;
  const c = minutes<180?"#34C759":minutes<360?"#FF9500":"#FF3B30";
  return <div className="h-[2px] rounded-full overflow-hidden w-full mt-1" style={{backgroundColor:"rgba(128,128,128,0.15)"}}>
    <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,backgroundColor:c}}/>
  </div>;
}

/* ─── Visual de evento na timeline ──────────────────────── */
function EventContent({task, height, onToggle}){
  const done = !!task.completed_at, urgent = task.is_urgent && !done;
  const color = done?"#636366":urgent?"#FF3B30":"#34C759";
  const bg = done?"rgba(99,99,102,0.07)":urgent?"rgba(255,59,48,0.09)":"rgba(52,199,89,0.09)";
  return (
    <div className="w-full h-full flex gap-1.5 px-1.5 py-1 overflow-hidden rounded-r-sm"
      style={{backgroundColor:bg, borderLeft:`2.5px solid ${color}`, borderRadius:"0 3px 3px 0"}}>
      <button
        onPointerDown={e=>e.stopPropagation()}
        onClick={e=>{e.stopPropagation();e.preventDefault();onToggle?.(task);}}
        className="mt-[2px] shrink-0 transition-opacity hover:opacity-70"
      >
        <EventCircle done={done} urgent={urgent} size={11}/>
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-medium leading-snug truncate ${done?"line-through":""}` } style={{color: done?"#636366":color, opacity: done?0.45:1}}>
          {task.title}
        </p>
        {height>38 && task.scheduled_time && (
          <p className="text-[9.5px] mt-0.5 leading-none tabular-nums" style={{color, opacity:0.55}}>
            {task.scheduled_time.slice(0,5)}{task.duration_minutes && task.duration_minutes!==30?` · ${task.duration_minutes}min`:""}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Evento arrastável ──────────────────────────────────── */
function DraggableEvent({task, col, total, onSelect, onToggle}){
  const start = timeToMinutes(task.scheduled_time)??(GRID_START_H*60);
  const dur   = task.duration_minutes??30;
  const top   = ((start-GRID_START_H*60)/60)*HOUR_HEIGHT;
  const height= Math.max(22,(dur/60)*HOUR_HEIGHT);
  const w     = `${100/total}%`;
  const left  = `${(col/total)*100}%`;

  const {attributes,listeners,setNodeRef,transform,isDragging} = useDraggable({id:task.id, data:{task}});

  return (
    <div
      ref={setNodeRef}
      data-task-id={task.id}
      style={{
        position:"absolute", top, left, width:w, height,
        transform: transform?`translate3d(${transform.x}px,${transform.y}px,0)`:undefined,
        opacity: isDragging?0.25:1,
        zIndex: isDragging?0:2,
        touchAction:"none",
        paddingLeft: col>0?1:0,
        paddingRight: col<total-1?1:0,
        cursor:"grab",
      }}
      {...attributes} {...listeners}
      onClick={e=>{if(!isDragging){e.stopPropagation();onSelect(task);}}}
    >
      <EventContent task={task} height={height} onToggle={onToggle}/>
    </div>
  );
}

/* ─── Coluna droppable de um dia ─────────────────────────── */
function DayCol({dateStr, isToday, children, onDoubleClick}){
  const {setNodeRef, isOver} = useDroppable({id:dateStr});
  return (
    <div
      ref={setNodeRef}
      onDoubleClick={e=>onDoubleClick(e,dateStr)}
      className="flex-1 relative border-l border-border/[0.18] min-w-0 transition-colors"
      style={{
        minWidth:0,
        backgroundColor: isOver?"rgba(79,142,247,0.05)":isToday?"rgba(79,142,247,0.025)":"transparent",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Timeline multi-dia ─────────────────────────────────── */
function TimeGrid({days, tasksByDay, today, onTaskSelect, onTaskToggle, onDoubleClick, gridRef}){
  const now = new Date();
  const nowMin = now.getHours()*60+now.getMinutes();

  return (
    <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{scrollbarWidth:"thin"}}>
      <div style={{height:gridHours.length*HOUR_HEIGHT, width:"100%", position:"relative"}} className="flex">

        {/* Horas */}
        <div className="w-11 shrink-0 relative z-10" style={{background:"inherit"}}>
          {gridHours.map(h=>(
            <div key={h} style={{position:"absolute",top:(h-GRID_START_H)*HOUR_HEIGHT,right:0,left:0}} className="flex justify-end pr-2.5">
              <span className="text-[10px] tabular-nums leading-none -mt-[6px] select-none"
                style={{color:"rgba(128,128,128,0.40)"}}>
                {String(h).padStart(2,"0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Colunas */}
        {days.map(dateStr=>{
          const isToday = dateStr===today;
          const timedTasks = (tasksByDay[dateStr]??[]).filter(t=>t.scheduled_time);
          const laid = layoutEvents(timedTasks);
          return (
            <DayCol key={dateStr} dateStr={dateStr} isToday={isToday} onDoubleClick={onDoubleClick}>
              {/* Linhas de hora + meia hora */}
              {gridHours.flatMap(h=>[
                <div key={`h${h}`} style={{position:"absolute",top:(h-GRID_START_H)*HOUR_HEIGHT,left:0,right:0,
                  borderTop:"1px solid rgba(128,128,128,0.16)"}}/>,
                <div key={`hh${h}`} style={{position:"absolute",top:(h-GRID_START_H)*HOUR_HEIGHT+HOUR_HEIGHT/2,left:0,right:0,
                  borderTop:"1px solid rgba(128,128,128,0.06)"}}/>,
              ])}
              {laid.map(({task,col,total})=>(
                <DraggableEvent key={task.id} task={task} col={col} total={total}
                  onSelect={onTaskSelect} onToggle={onTaskToggle}/>
              ))}
            </DayCol>
          );
        })}

        {/* Linha "agora" */}
        {days.includes(today) && nowMin>=GRID_START_H*60 && nowMin<GRID_END_H*60 && (
          <div style={{position:"absolute",top:((nowMin-GRID_START_H*60)/60)*HOUR_HEIGHT,left:44,right:0,zIndex:20,pointerEvents:"none"}}
            className="flex items-center">
            <div className="shrink-0 rounded-full -ml-[3px]"
              style={{width:7,height:7,backgroundColor:"#FF3B30",boxShadow:"0 0 5px rgba(255,59,48,0.6)"}}/>
            <div className="flex-1" style={{borderTop:"1px solid rgba(255,59,48,0.55)"}}/>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Cabeçalho das colunas ──────────────────────────────── */
function DayHeaders({days, tasksByDay, today}){
  const DAY_NAMES = ["dom","seg","ter","qua","qui","sex","sáb"];
  return (
    <div className="flex shrink-0" style={{borderBottom:"1px solid rgba(128,128,128,0.18)"}}>
      <div className="w-11 shrink-0"/>
      {days.map(dateStr=>{
        const d = new Date(dateStr+"T12:00:00");
        const isToday = dateStr===today;
        const isWeekend = d.getDay()===0||d.getDay()===6;
        const label = `${DAY_NAMES[d.getDay()]}., ${d.getDate()}`;
        return (
          <div
            key={dateStr}
            className="flex-1 flex items-center justify-center py-3 min-w-0"
            style={{borderLeft:"1px solid rgba(128,128,128,0.12)"}}
          >
            {isToday ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold select-none"
                style={{backgroundColor:"rgba(79,142,247,0.15)",color:"#4F8EF7", letterSpacing:"-0.01em"}}>
                {label}
              </span>
            ) : (
              <span className="text-[11.5px] font-normal select-none tracking-tight"
                style={{color: isWeekend?"rgba(255,59,48,0.45)":"rgba(128,128,128,0.50)"}}>
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Linha "dia inteiro" ────────────────────────────────── */
function AllDayRow({days, tasksByDay, onTaskSelect}){
  return (
    <div className="flex shrink-0" style={{minHeight:26,maxHeight:80,borderBottom:"1px solid rgba(128,128,128,0.12)"}}>
      <div className="w-11 shrink-0 flex items-end justify-end pr-2.5 pb-1.5">
        <span className="text-[9px] select-none leading-none" style={{color:"rgba(128,128,128,0.30)"}}>dia inteiro</span>
      </div>
      {days.map(dateStr=>{
        const tasks=(tasksByDay[dateStr]??[]).filter(t=>!t.scheduled_time);
        return (
          <div key={dateStr} className="flex-1 flex flex-wrap gap-0.5 px-1 py-1 min-w-0"
            style={{borderLeft:"1px solid rgba(128,128,128,0.12)"}}>
            {tasks.slice(0,2).map(t=>(
              <button key={t.id} onClick={()=>onTaskSelect(t)}
                className="flex items-center gap-0.5 max-w-full overflow-hidden">
                <EventCircle done={!!t.completed_at} urgent={t.is_urgent&&!t.completed_at} size={9}/>
                <span className={`text-[9px] truncate ${t.completed_at?"line-through text-text-secondary/50":"text-text-main"}`}>
                  {t.title}
                </span>
              </button>
            ))}
            {tasks.length>2&&<span className="text-[8px] text-text-secondary/50">mais {tasks.length-2}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Visão Mês ──────────────────────────────────────────── */
const MONTH_SHORT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function MonthView({anchor, tasksByDay, today, onDaySelect, onTaskSelect}){
  const ref = new Date(anchor+"T12:00:00");
  const year=ref.getFullYear(), month=ref.getMonth();

  // iOS usa domingo como primeira coluna (getDay() 0=dom)
  const first=new Date(year,month,1);
  const skip = first.getDay(); // 0=dom → skip 0, 1=seg → skip 1, etc.
  const start=new Date(first); start.setDate(1-skip);

  const weeks=[];
  const cur=new Date(start);
  for(let w=0;w<6;w++){
    const week=[];
    for(let d=0;d<7;d++){week.push(localDateStr(cur));cur.setDate(cur.getDate()+1);}
    weeks.push(week);
    // Para quando a semana extra começa em mês seguinte
    if(w>=4&&new Date(week[6]+"T12:00:00").getMonth()!==month) break;
  }

  // Cabeçalho: dom, seg, ter, qua, qui, sex, sáb  (iOS = Sunday first)
  const DN=["dom.","seg.","ter.","qua.","qui.","sex.","sáb."];

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

      {/* Cabeçalho dos dias */}
      <div className="grid grid-cols-7 shrink-0" style={{borderBottom:"1px solid rgba(128,128,128,0.18)"}}>
        {DN.map((d,i)=>{
          const isWknd = i===0||i===6;
          return (
            <div key={d} className="text-center py-2 text-[9.5px] font-medium select-none tracking-widest uppercase"
              style={{color: isWknd?"rgba(255,59,48,0.40)":"rgba(128,128,128,0.40)"}}>
              {d}
            </div>
          );
        })}
      </div>

      {/* Grade — cada semana ocupa 1fr da altura disponível */}
      <div
        className="flex-1 min-h-0 overflow-hidden"
        style={{display:"grid", gridTemplateRows:`repeat(${weeks.length},1fr)`}}
      >
        {weeks.map((week,wi)=>(
          <div
            key={wi}
            className="min-h-0"
            style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)"}}
          >
            {week.map(dateStr=>{
              const d      = new Date(dateStr+"T12:00:00");
              const dayNum = d.getDate();
              const dayMonth = d.getMonth();
              const inMonth= dayMonth===month;
              const isToday= dateStr===today;
              const isWknd = d.getDay()===0||d.getDay()===6;
              // Exibe "1 de jul." quando é o dia 1 de qualquer mês
              const isFirstOfMonth = dayNum===1;
              const dayLabel = isFirstOfMonth
                ? `1 de ${MONTH_SHORT[dayMonth]}.`
                : String(dayNum);

              const allTasks = (tasksByDay[dateStr]??[]).slice().sort((a,b)=>{
                const ad=a.completed_at?1:0, bd=b.completed_at?1:0;
                if(ad!==bd) return ad-bd;
                return (a.scheduled_time??"")<(b.scheduled_time??"")?-1:1;
              });
              const MAX=4;
              const visible=allTasks.slice(0,MAX);
              const overflow=allTasks.length-MAX;

              return (
                <div
                  key={dateStr}
                  onClick={()=>onDaySelect(dateStr)}
                  className="flex flex-col min-h-0 overflow-hidden cursor-pointer transition-colors"
                  style={{
                    borderRight:"1px solid rgba(128,128,128,0.12)",
                    borderBottom:"1px solid rgba(128,128,128,0.12)",
                    backgroundColor: isToday?"rgba(79,142,247,0.04)":"transparent",
                  }}
                  onMouseEnter={e=>{ if(inMonth) e.currentTarget.style.backgroundColor=isToday?"rgba(79,142,247,0.07)":"rgba(128,128,128,0.04)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.backgroundColor=isToday?"rgba(79,142,247,0.04)":"transparent"; }}
                >
                  {/* Número do dia — alinhado à DIREITA (estilo iOS) */}
                  <div className="pr-1.5 pt-1 pb-0.5 flex justify-end shrink-0">
                    <span className={[
                      "inline-flex items-center justify-center rounded-full text-[11px] leading-none px-1",
                      isFirstOfMonth ? "text-[9.5px] h-[20px] min-w-[20px]" : "w-[20px] h-[20px]",
                      isToday
                        ? "bg-primary text-white font-bold"
                        : !inMonth
                          ? "text-text-secondary/20"
                          : isWknd
                            ? "text-danger/70 font-medium"
                            : "text-text-main font-medium",
                    ].join(" ")}>
                      {dayLabel}
                    </span>
                  </div>

                  {/* Tarefas */}
                  <div className="flex-1 min-h-0 overflow-hidden px-0.5 pb-0.5 flex flex-col gap-px">
                    {visible.map(t=>{
                      const done=!!t.completed_at;
                      const urgent=t.is_urgent&&!done;
                      const dotColor=done?"#636366":urgent?"#FF3B30":"#30D158";
                      return (
                        <button
                          key={t.id}
                          onClick={e=>{e.stopPropagation();onTaskSelect(t);}}
                          className={[
                            "w-full flex items-center gap-1 text-left px-1 py-[1.5px] rounded transition-colors overflow-hidden shrink-0",
                            !inMonth?"opacity-25":"",
                          ].join(" ")}
                        >
                          {/* Círculo colorido (iOS usa círculo, não ponto) */}
                          <span
                            className={`shrink-0 rounded-full border-2`}
                            style={{
                              width:10, height:10,
                              borderColor: dotColor,
                              backgroundColor: done ? dotColor : "transparent",
                              opacity: done ? 0.5 : 1,
                              flexShrink:0,
                            }}
                          />
                          {/* Título */}
                          <span className={[
                            "flex-1 min-w-0 text-[10px] leading-snug truncate",
                            done?"line-through text-text-secondary/35":"text-text-main",
                          ].join(" ")}>
                            {t.title}
                          </span>
                          {/* Horário à direita */}
                          {t.scheduled_time&&(
                            <span className="shrink-0 text-[8.5px] tabular-nums text-text-secondary/45 ml-0.5 leading-none">
                              {t.scheduled_time.slice(0,5)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {overflow>0&&(
                      <p className="text-[9px] text-text-secondary/40 pl-2.5 leading-tight shrink-0 select-none">
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

/* ─── Mini mês (para visão Ano) ──────────────────────────── */
function MiniMonthGrid({year, month, tasksByDay, today, onDayClick}){
  const first=new Date(year,month,1);
  const skip=first.getDay(); // domingo=0 → skip 0 (Sunday first, igual ao MonthView)
  const start=new Date(first); start.setDate(1-skip);
  const cells=[];
  const cur=new Date(start);
  for(let i=0;i<42;i++){
    cells.push({str:localDateStr(cur), d:cur.getDate(), inMonth:cur.getMonth()===month, wd:cur.getDay()});
    cur.setDate(cur.getDate()+1);
    if(i>=34&&cur.getMonth()!==month) break;
  }
  const MNAME=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"][month];
  const DN2=["D","S","T","Q","Q","S","S"]; // dom primeiro
  return (
    <div>
      <p className="text-[11px] font-semibold mb-2 capitalize tracking-tight" style={{color:"rgba(200,200,200,0.85)"}}>{MNAME}</p>
      <div className="grid grid-cols-7">
        {DN2.map((l,i)=>(
          <span key={i} className="text-center pb-1 text-[7.5px] font-medium select-none"
            style={{color: i===0||i===6 ?"rgba(255,59,48,0.40)":"rgba(128,128,128,0.35)"}}>
            {l}
          </span>
        ))}
        {cells.map(({str,d,inMonth,wd})=>{
          const isToday=str===today;
          const hasTasks=(tasksByDay[str]??[]).some(t=>!t.completed_at);
          const isWknd=wd===0||wd===6;
          return (
            <button key={str} onClick={()=>onDayClick(str)}
              className="flex flex-col items-center pb-0.5 transition-opacity hover:opacity-80">
              <span className="w-[18px] h-[18px] flex items-center justify-center rounded-full text-[8.5px] leading-none font-medium"
                style={{
                  backgroundColor: isToday?"#4F8EF7":"transparent",
                  color: isToday?"#fff":!inMonth?"rgba(128,128,128,0.20)":isWknd?"rgba(255,59,48,0.55)":"rgba(200,200,200,0.80)",
                  fontWeight: isToday?700:400,
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
    <div className="flex-1 min-h-0 overflow-y-auto p-5">
      <div className="grid grid-cols-4 gap-x-8 gap-y-8">
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
  const today = localDateStr();

  const [view,      setView]      = useState("day");
  const [anchor,    setAnchor]    = useState(today);
  const [selected,  setSelected]  = useState(null);
  const [dragging,  setDragging]  = useState(null);
  const gridRef = useRef(null);

  const isTimeline = ["day","3day","workweek","week"].includes(view);
  const days = isTimeline ? getDays(view, anchor) : [];

  const tasksByDay = tasks.reduce((acc,t)=>{
    if(!t.scheduled_date||t.deleted_at) return acc;
    (acc[t.scheduled_date]??=[]).push(t); return acc;
  },{});

  const goBack    = useCallback(()=>setAnchor(a=>navigate(view,a,-1)),[view]);
  const goForward = useCallback(()=>setAnchor(a=>navigate(view,a, 1)),[view]);
  const goToday   = useCallback(()=>setAnchor(today),[today]);

  const handleToggle = useCallback(async t=>{
    if(t.completed_at) await uncompleteTask(t.id); else await completeTask(t.id);
  },[completeTask,uncompleteTask]);

  /* ── Duplo clique: criar tarefa com data/hora ── */
  const handleDoubleClick = useCallback(async(e, dateStr)=>{
    if(e.target.closest("[data-task-id]")) return; // não disparar em cima de tarefa
    const col = e.currentTarget;
    const rect = col.getBoundingClientRect();
    const yInCol = e.clientY - rect.top;
    const minOffset = (yInCol / HOUR_HEIGHT) * 60;
    const total = snapQ(GRID_START_H*60 + minOffset);
    const clamped = Math.max(GRID_START_H*60, Math.min((GRID_END_H-1)*60, total));
    const time = minutesToTime(clamped);
    const newTask = await createTask({ scheduled_date: dateStr, scheduled_time: time, title: "" });
    if(newTask) setSelected(newTask);
  },[createTask]);

  /* ── Scroll para hora atual ── */
  useEffect(()=>{
    if(!gridRef.current||!isTimeline) return;
    const now = new Date();
    const min = now.getHours()*60+now.getMinutes();
    const offset = ((min-GRID_START_H*60)/60)*HOUR_HEIGHT - 100;
    gridRef.current.scrollTop = Math.max(0, offset);
  },[view]);

  /* ── DnD ── */
  const sensors = useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}));

  const onDragStart = ({active})=>setDragging(active.data.current?.task??null);
  const onDragEnd = async ({active,over,delta})=>{
    setDragging(null);
    if(!over||!active.data.current) return;
    const task=active.data.current.task;
    const newDate=over.id;
    const orig=timeToMinutes(task.scheduled_time)??(GRID_START_H*60);
    const deltaMin=(delta.y/HOUR_HEIGHT)*60;
    const snapped=snapQ(orig+deltaMin);
    const clamped=Math.max(GRID_START_H*60,Math.min((GRID_END_H-1)*60,snapped));
    const newTime=minutesToTime(clamped);
    if(newDate!==task.scheduled_date||newTime!==task.scheduled_time){
      const updated = await updateTask(task.id,{scheduled_date:newDate,scheduled_time:newTime});
      // Atualiza o painel lateral se a tarefa arrastada estiver aberta
      if(updated && selected?.id===task.id) setSelected(updated);
    }
  };

  /* ── Atalhos ── */
  useEffect(()=>{
    const h=e=>{
      const el=e.target;
      if(el.tagName==="INPUT"||el.tagName==="TEXTAREA"||el.isContentEditable) return;
      if(e.key==="Escape"&&selected){setSelected(null);return;}
      const k=e.key.toLowerCase();
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

  /* ── Cabeçalho dinâmico por visão ── */
  const headerTitle = view==="day"    ? fmtFull(anchor)
                    : view==="year"   ? fmtYear(anchor)
                    : fmtMonthYear(anchor);
  const headerSub   = view==="day"    ? fmtWeekday(anchor) : null;

  /* ── Dia selecionado em mês/ano → vai para dia ── */
  const onDaySelect = (dateStr)=>{ setAnchor(dateStr); setView("day"); };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex h-full overflow-hidden">

        {/* ── Coluna principal ── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden px-3 pt-4 pb-2 md:px-5">

          {/* Título + nav + visões */}
          <div className="shrink-0 mb-3 mr-36">
            {/* Título */}
            <div className="mb-3">
              <h1 className={[
                "font-semibold leading-none tracking-tight capitalize text-text-main",
                view==="year"?"text-3xl":"text-xl",
              ].join(" ")}>
                {headerTitle}
              </h1>
              {headerSub && (
                <p className="text-[12px] mt-1 capitalize" style={{color:"rgba(128,128,128,0.55)"}}>
                  {headerSub}
                </p>
              )}
            </div>

            {/* Nav + view switcher */}
            <div className="flex items-center gap-3">
              {/* Navegação */}
              <div className="flex items-center gap-1">
                <button onClick={goBack} title="← K"
                  className="w-7 h-7 flex items-center justify-center rounded-full transition-colors text-text-secondary hover:text-text-main hover:bg-card">
                  <ChevronLeft/>
                </button>
                <button onClick={goToday} title="Hoje (T)"
                  className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-all text-text-secondary hover:text-text-main"
                  style={{border:"1px solid rgba(128,128,128,0.25)"}}>
                  Hoje
                </button>
                <button onClick={goForward} title="J →"
                  className="w-7 h-7 flex items-center justify-center rounded-full transition-colors text-text-secondary hover:text-text-main hover:bg-card">
                  <ChevronRight/>
                </button>
              </div>

              {/* Segmented control */}
              <div className="ml-auto flex items-center p-0.5 rounded-lg gap-px"
                style={{backgroundColor:"rgba(128,128,128,0.10)",border:"1px solid rgba(128,128,128,0.14)"}}>
                {VIEWS.map(v=>{
                  const active = v.id===view||(v.id==="day"&&["3day","workweek"].includes(view));
                  return (
                    <button key={v.id} onClick={()=>setView(v.id)} title={`${v.label} (${v.shortcut})`}
                      className="text-[11px] px-3 py-1 rounded-md transition-all whitespace-nowrap font-medium"
                      style={{
                        backgroundColor: active?"rgba(255,255,255,0.08)":"transparent",
                        color: active?"rgba(220,220,220,0.95)":"rgba(128,128,128,0.55)",
                        boxShadow: active?"0 1px 3px rgba(0,0,0,0.25)":"none",
                      }}>
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Área de conteúdo */}
          {isTimeline ? (
            <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden"
              style={{border:"1px solid rgba(128,128,128,0.18)"}}>
              <DayHeaders days={days} tasksByDay={tasksByDay} today={today}/>
              <AllDayRow  days={days} tasksByDay={tasksByDay} onTaskSelect={setSelected}/>
              <TimeGrid
                days={days} tasksByDay={tasksByDay} today={today}
                onTaskSelect={setSelected} onTaskToggle={handleToggle}
                onDoubleClick={handleDoubleClick} gridRef={gridRef}
              />
              {view==="day"&&(
                <p className="text-[9px] text-center py-1.5 shrink-0 select-none"
                  style={{color:"rgba(128,128,128,0.25)"}}>
                  Duplo clique para criar · Arrastar para mover
                </p>
              )}
            </div>
          ) : view==="month" ? (
            <div className="flex-1 min-h-0 rounded-xl overflow-hidden"
              style={{border:"1px solid rgba(128,128,128,0.18)"}}>
              <MonthView anchor={anchor} tasksByDay={tasksByDay} today={today}
                onDaySelect={onDaySelect} onTaskSelect={setSelected}/>
            </div>
          ) : (
            <div className="flex-1 min-h-0 rounded-xl overflow-hidden"
              style={{border:"1px solid rgba(128,128,128,0.18)"}}>
              <YearView anchor={anchor} tasksByDay={tasksByDay} today={today}
                onDayClick={onDaySelect}/>
            </div>
          )}
        </div>

        {/* ── Painel lateral de edição ── */}
        {selected && (
          <div onClick={e=>e.stopPropagation()}>
            <TaskDetail key={selected.id} task={selected} onClose={()=>setSelected(null)}/>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging&&(
          <div style={{height:Math.max(22,((dragging.duration_minutes??30)/60)*HOUR_HEIGHT),width:160,opacity:0.9}}
            className="rounded-md shadow-xl overflow-hidden">
            <EventContent task={dragging} height={Math.max(22,((dragging.duration_minutes??30)/60)*HOUR_HEIGHT)}/>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
