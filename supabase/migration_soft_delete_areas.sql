-- Migration: soft-delete para Áreas e Projetos
alter table areas add column if not exists deleted_at timestamptz;
alter table projects add column if not exists deleted_at timestamptz;
