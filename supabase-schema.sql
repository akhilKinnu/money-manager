-- ========================================================
-- FinTrack Pro - Supabase PostgreSQL Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ========================================================

-- 1. Create table for user financial data
create table if not exists public.fintrack_vault (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS) so each user only accesses their own data
alter table public.fintrack_vault enable row level security;

-- 3. Policy: Allow users to view only their own record
create policy "Users can select own fintrack data"
  on public.fintrack_vault for select
  using (auth.uid() = user_id);

-- 4. Policy: Allow users to insert their own record
create policy "Users can insert own fintrack data"
  on public.fintrack_vault for insert
  with check (auth.uid() = user_id);

-- 5. Policy: Allow users to update their own record
create policy "Users can update own fintrack data"
  on public.fintrack_vault for update
  using (auth.uid() = user_id);

-- 6. Enable real-time replication for this table
alter publication supabase_realtime add table public.fintrack_vault;
