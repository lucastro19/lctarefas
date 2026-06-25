-- Migration: agendamento por horário e duração
alter table tasks add column if not exists scheduled_time text;
alter table tasks add column if not exists duration_minutes integer;
