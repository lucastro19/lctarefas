-- Migration: prioridade de tarefa
alter table tasks add column if not exists priority text check (priority in ('low', 'medium', 'high'));
