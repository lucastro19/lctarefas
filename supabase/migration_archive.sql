-- Migration: adicionar suporte a arquivamento de Áreas e Projetos
alter table areas add column if not exists archived_at timestamptz;
alter table projects add column if not exists archived_at timestamptz;
