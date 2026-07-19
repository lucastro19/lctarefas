-- Migration: sistema de agendamento público (mini-Calendly)

-- Perfil público de agendamento (um por usuário)
create table if not exists booking_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  slug text unique not null,
  display_name text not null,
  title text,
  bio text,
  meeting_duration integer not null default 30,  -- minutos
  buffer_minutes integer not null default 15,     -- pausa entre reuniões
  advance_days integer not null default 30,       -- quantos dias à frente mostrar
  min_notice_hours integer not null default 2,    -- mínimo de antecedência para agendar
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Disponibilidade semanal recorrente
create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Dom, 1=Seg, ..., 6=Sab
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  constraint availability_user_day unique (user_id, day_of_week)
);

-- Agendamentos feitos por clientes
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  guest_name text not null,
  guest_email text not null,
  guest_notes text,
  scheduled_at timestamptz not null,
  duration_minutes integer not null,
  meeting_url text,
  task_id uuid references tasks(id) on delete set null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz default now()
);

-- RLS
alter table booking_profiles enable row level security;
alter table availability enable row level security;
alter table bookings enable row level security;

-- booking_profiles: leitura pública por slug, escrita apenas pelo dono
create policy "booking_profiles_public_read" on booking_profiles
  for select using (true);
create policy "booking_profiles_owner_all" on booking_profiles
  for all using (auth.uid() = user_id);

-- availability: leitura pública, escrita apenas pelo dono
create policy "availability_public_read" on availability
  for select using (true);
create policy "availability_owner_all" on availability
  for all using (auth.uid() = user_id);

-- bookings: cliente pode inserir (anon), dono vê/atualiza os seus
create policy "bookings_public_insert" on bookings
  for insert with check (true);
create policy "bookings_owner_read" on bookings
  for select using (auth.uid() = user_id);
create policy "bookings_owner_update" on bookings
  for update using (auth.uid() = user_id);
