-- Pitchcraft — skema Supabase. Jalankan di SQL Editor (satu kali). Uji dengan dua akun sebelum dipakai pengguna.
-- Kunci utama (user_id, id): ID dibuat di klien, jadi tidak boleh bertabrakan antar pengguna.

create table public.sessions (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null check (char_length(id) <= 80),
  mode       text not null check (char_length(mode) <= 20),
  level      text not null default '' check (char_length(level) <= 20),
  dur        int  not null check (dur between 0 and 7200),
  ok         int  not null check (ok between 0 and 10000),
  bad        int  not null check (bad between 0 and 10000),
  cpm        numeric not null check (cpm between 0 and 1000),
  played_at  timestamptz not null,
  day        date not null,                       -- tanggal lokal saat sesi (dasar streak, kebal ganti zona waktu)
  created_at timestamptz not null default now(),  -- waktu server (kursor sinkron)
  primary key (user_id, id)
);
create index sessions_user_created on public.sessions (user_id, created_at);

create table public.badges (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  badge_id  text not null check (char_length(badge_id) <= 40),
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table public.songs (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null check (char_length(id) <= 80),
  data       jsonb not null check (octet_length(data::text) <= 1000000),
  updated_at timestamptz not null default now(),  -- diisi trigger (waktu server)
  deleted_at timestamptz,                         -- tombstone (belum dipakai UI versi ini)
  primary key (user_id, id)
);

create table public.settings (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data           jsonb not null check (octet_length(data::text) <= 200000),
  schema_version int not null default 1,
  updated_at     timestamptz not null default now()
);

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

-- waktu server menjadi penentu "terbaru", bukan jam perangkat
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger songs_touch    before insert or update on public.songs
  for each row execute function public.set_updated_at();
create trigger settings_touch before insert or update on public.settings
  for each row execute function public.set_updated_at();

-- Row Level Security: wajib. Tanpa ini kunci publik di kode klien TIDAK aman.
alter table public.sessions enable row level security;
alter table public.badges   enable row level security;
alter table public.songs    enable row level security;
alter table public.settings enable row level security;
alter table public.misses   enable row level security;

-- sesi & lencana hanya bertambah (tanpa update/hapus dari klien)
create policy sessions_select on public.sessions for select using ((select auth.uid()) = user_id);
create policy sessions_insert on public.sessions for insert with check ((select auth.uid()) = user_id);
create policy badges_select   on public.badges   for select using ((select auth.uid()) = user_id);
create policy badges_insert   on public.badges   for insert with check ((select auth.uid()) = user_id);
create policy misses_select on public.misses for select using ((select auth.uid()) = user_id);
create policy misses_insert on public.misses for insert with check ((select auth.uid()) = user_id);
create policy songs_all       on public.songs    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy settings_all    on public.settings for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- hapus akun sendiri (semua baris ikut terhapus lewat on delete cascade)
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
