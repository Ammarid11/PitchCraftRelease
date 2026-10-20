-- Pitchcraft — migrasi: tabel catatan akor salah. Jalankan SEKALI di SQL Editor jika database sudah dipasang sebelum 20 Okt 2026.
-- (Pemasangan baru cukup memakai schema.sql, yang sudah memuat ini.)

create table public.misses (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id          text not null check (char_length(id) <= 80),
  want        text not null check (char_length(want) <= 20),   -- akor yang diminta
  got         text not null check (char_length(got) <= 20),    -- akor yang terbaca
  happened_at timestamptz not null,
  created_at  timestamptz not null default now(),              -- waktu server (kursor sinkron)
  primary key (user_id, id)
);
create index misses_user_created on public.misses (user_id, created_at);
alter table public.misses enable row level security;
-- append-only dari klien, seperti sessions
create policy misses_select on public.misses for select using ((select auth.uid()) = user_id);
create policy misses_insert on public.misses for insert with check ((select auth.uid()) = user_id);
