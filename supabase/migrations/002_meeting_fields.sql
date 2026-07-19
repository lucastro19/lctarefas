-- Migration 002: campos de reunião Google Meet
-- Execute no SQL Editor do Supabase Dashboard

alter table tasks
  add column if not exists meeting_url text,
  add column if not exists meeting_event_id text,
  add column if not exists meeting_attendees text[];
