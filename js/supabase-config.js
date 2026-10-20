/* Pitchcraft — Konfigurasi Supabase. Kosongkan url/anonKey = fitur akun mati (app tetap jalan offline).
 * Isi dengan "Project URL" dan kunci publik "anon/publishable" dari Supabase (Project Settings → API).
 * JANGAN PERNAH menaruh service_role key di sini atau di file mana pun yang dikirim ke pengguna. */
window.PC_SUPABASE = {
    url: 'https://sycegcaoipljspdcihzf.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Y2VnY2FvaXBsanNwZGNpaHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NzYwNDQsImV4cCI6MjEwODA1MjA0NH0.SNEdctJ_EQSNskfQNY4BKyxhBiBqt5eL1tb5d2J4Ius',
    // pustaka klien, dikunci ke versi tertentu; naikkan ke versi stabil terbaru (yang sudah berumur > 2 minggu) setelah mengujinya
    lib: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.js'
};
