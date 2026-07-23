-- ================================================================
-- FASE 2.2 — Configurações da Organização
-- Execute no SQL Editor do Supabase.
--
-- Adiciona um saco de configurações por org (gamificação/alertas do
-- §09/§10 do blueprint). Coberto pela policy organizations_owner_all
-- já existente — só o dono lê/grava. Inerte até as Fases 2.7/2.9.
-- ================================================================
alter table organizations
  add column if not exists settings jsonb not null default '{}'::jsonb;
