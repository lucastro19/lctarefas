-- Migration: lembrete com antecedência por tarefa
alter table tasks add column if not exists reminder_minutes integer;
