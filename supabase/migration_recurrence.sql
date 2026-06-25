-- Migration: recorrência de tarefas
alter table tasks add column if not exists recurrence text;
-- valores possíveis: null, 'daily', 'weekdays', 'weekly', 'monthly'
