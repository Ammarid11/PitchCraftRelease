/* Pitchcraft — uji RLS dengan DUA akun uji terhadap Supabase ASLI (bukan server palsu).
 * Jalankan (Node 18+):
 *   A_EMAIL=a@contoh.com A_PASS=... B_EMAIL=b@contoh.com B_PASS=... node tests/rls.test.js
 * atau pakai token akses langsung (mis. dari sesi browser):  A_TOKEN=... B_TOKEN=... node tests/rls.test.js
 * Opsi:  --hapus-akun-b   juga menguji delete_my_account untuk akun B (AKUN B DIHAPUS PERMANEN, pakai akun uji!)
 *
 * Syarat: buat dua akun UJI di Supabase (Authentication -> Users, centang auto-confirm, beri password). Jangan pakai akun asli.
 * Baris uji berawalan "rlstest-". Sesi & lencana tidak bisa dihapus dari klien (RLS append-only), jadi sisa baris uji
 * dibersihkan lewat SQL Editor:  delete from public.sessions where id like 'rlstest-%';  delete from public.badges where badge_id like 'rlstest-%';  delete from public.misses where id like 'rlstest-%';
 * URL dan anon key dibaca dari js/supabase-config.js. Skrip ini tidak butuh dan tidak boleh diberi service_role key. */
const fs = require('fs'), path = require('path');
const cfgSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'supabase-config.js'), 'utf8');
const URL_ = (/url:\s*'([^']+)'/.exec(cfgSrc) || [])[1], KEY = (/anonKey:\s*'([^']+)'/.exec(cfgSrc) || [])[1];
if (!URL_ || !KEY) { console.error('url/anonKey tidak ditemukan di js/supabase-config.js'); process.exit(1); }

let fails = 0;
const ok = (c, m) => { console.log((c ? 'LULUS  ' : 'GAGAL  ') + m); if (!c) fails++; };

async function login(who) {
    const tok = process.env[who + '_TOKEN'];
    if (tok) { const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()); return { token: tok, id: p.sub }; }
    const email = process.env[who + '_EMAIL'], password = process.env[who + '_PASS'];
    if (!email || !password) { console.error(`Isi ${who}_TOKEN atau ${who}_EMAIL + ${who}_PASS`); process.exit(1); }
    const r = await fetch(URL_ + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await r.json(); if (!j.access_token) { console.error('Login ' + who + ' gagal:', j.error_description || j.msg || JSON.stringify(j)); process.exit(1); }
    return { token: j.access_token, id: j.user.id };
}
// token null = anon (tanpa login)
const api = (token, method, pathq, body, extra) => fetch(URL_ + '/rest/v1/' + pathq, {
    method, headers: Object.assign({ apikey: KEY, Authorization: 'Bearer ' + (token || KEY), 'Content-Type': 'application/json', Prefer: 'return=representation' }, extra || {}),
    body: body === undefined ? undefined : JSON.stringify(body)
}).then(async r => { let j = null; try { j = await r.json(); } catch (e) { } return { status: r.status, body: j }; });
const rows = r => Array.isArray(r.body) ? r.body : [];
const denied = r => r.status >= 400 || rows(r).length === 0;   // ditolak, atau tidak ada baris yang kena

(async () => {
    const A = await login('A'), B = await login('B');
    if (A.id === B.id) { console.error('Akun A dan B harus berbeda.'); process.exit(1); }
    const tag = 'rlstest-' + Date.now(), day = new Date().toISOString().slice(0, 10), now = new Date().toISOString();
    const sess = id => ({ id, mode: 'level', level: 'dasar', dur: 60, ok: 5, bad: 1, cpm: 5, played_at: now, day });
    console.log('Akun A = ' + A.id + '\nAkun B = ' + B.id + '\n');

    // ---- A menulis data miliknya ----
    let r = await api(A.token, 'POST', 'sessions', sess(tag + '-s'));            ok(r.status === 201, 'A bisa insert sesi miliknya (status ' + r.status + ')');
    r = await api(A.token, 'POST', 'badges', { badge_id: tag + '-b' });          ok(r.status === 201, 'A bisa insert lencana miliknya (status ' + r.status + ')');
    r = await api(A.token, 'POST', 'songs', { id: tag + '-song', data: { name: 'rahasia A', sections: [] } }); ok(r.status === 201, 'A bisa insert lagu (status ' + r.status + ')');
    r = await api(A.token, 'POST', 'settings', { data: { v: 1, rahasia: 'A' } }, { Prefer: 'return=representation,resolution=merge-duplicates' });
    ok(r.status === 201 || r.status === 200, 'A bisa menulis pengaturan (status ' + r.status + ')');

    r = await api(A.token, 'POST', 'misses', { id: tag + '-m', want: 'Am', got: 'C', happened_at: now });  ok(r.status === 201, 'A bisa insert catatan akor salah (status ' + r.status + ')');

    // ---- B tidak boleh MELIHAT data A ----
    r = await api(B.token, 'GET', 'sessions?id=eq.' + tag + '-s');               ok(rows(r).length === 0, 'B tidak melihat sesi A');
    r = await api(B.token, 'GET', 'badges?badge_id=eq.' + tag + '-b');           ok(rows(r).length === 0, 'B tidak melihat lencana A');
    r = await api(B.token, 'GET', 'songs?id=eq.' + tag + '-song');               ok(rows(r).length === 0, 'B tidak melihat lagu A');
    r = await api(B.token, 'GET', 'settings?user_id=eq.' + A.id);                ok(rows(r).length === 0, 'B tidak melihat pengaturan A');
    r = await api(B.token, 'GET', 'sessions?user_id=eq.' + A.id);                ok(rows(r).length === 0, 'B tidak bisa menyaring sesi lewat user_id A');
    r = await api(B.token, 'GET', 'misses?id=eq.' + tag + '-m');                  ok(rows(r).length === 0, 'B tidak melihat catatan akor salah A');
    // ---- anon (tanpa login) ----
    for (const t of ['sessions', 'badges', 'songs', 'settings', 'misses']) { r = await api(null, 'GET', t + '?select=*'); ok(rows(r).length === 0, 'tanpa login: tabel ' + t + ' kosong/ditolak'); }

    // ---- B tidak boleh MENULIS atas nama A atau mengubah data A ----
    r = await api(B.token, 'POST', 'sessions', Object.assign(sess(tag + '-forge'), { user_id: A.id }));  ok(r.status >= 400, 'B tidak bisa insert sesi dengan user_id A (status ' + r.status + ')');
    r = await api(B.token, 'POST', 'songs', { user_id: A.id, id: tag + '-forge', data: {} });          ok(r.status >= 400, 'B tidak bisa insert lagu atas nama A (status ' + r.status + ')');
    r = await api(B.token, 'PATCH', 'songs?id=eq.' + tag + '-song', { data: { name: 'dibajak B' } });  ok(denied(r), 'B tidak bisa mengubah lagu A');
    r = await api(B.token, 'DELETE', 'songs?id=eq.' + tag + '-song');                                   ok(denied(r), 'B tidak bisa menghapus lagu A');
    r = await api(B.token, 'PATCH', 'settings?user_id=eq.' + A.id, { data: { dibajak: 1 } });          ok(denied(r), 'B tidak bisa mengubah pengaturan A');
    r = await api(B.token, 'DELETE', 'sessions?id=eq.' + tag + '-s');                                  ok(denied(r), 'B tidak bisa menghapus sesi A');

    // ---- sesi & lencana append-only: pemilik pun tidak boleh ubah/hapus dari klien ----
    r = await api(A.token, 'PATCH', 'sessions?id=eq.' + tag + '-s', { dur: 7200 });                    ok(denied(r), 'A tidak bisa mengubah sesinya sendiri (append-only)');
    r = await api(A.token, 'DELETE', 'sessions?id=eq.' + tag + '-s');                                   ok(denied(r), 'A tidak bisa menghapus sesinya sendiri (append-only)');
    r = await api(A.token, 'DELETE', 'badges?badge_id=eq.' + tag + '-b');                               ok(denied(r), 'A tidak bisa menghapus lencananya sendiri (append-only)');

    r = await api(B.token, 'POST', 'misses', { user_id: A.id, id: tag + '-mf', want: 'Am', got: 'C', happened_at: now }); ok(r.status >= 400, 'B tidak bisa insert catatan salah atas nama A (status ' + r.status + ')');
    r = await api(A.token, 'PATCH', 'misses?id=eq.' + tag + '-m', { got: 'X' });                       ok(denied(r), 'A tidak bisa mengubah catatan salahnya (append-only)');
    r = await api(A.token, 'DELETE', 'misses?id=eq.' + tag + '-m');                                    ok(denied(r), 'A tidak bisa menghapus catatan salahnya (append-only)');

    // ---- batas dari skema (check constraint) ----
    r = await api(A.token, 'POST', 'sessions', Object.assign(sess(tag + '-big'), { dur: 999999 }));    ok(r.status >= 400, 'sesi dengan dur di luar batas ditolak (status ' + r.status + ')');

    // ---- data A masih utuh setelah semua serangan B ----
    r = await api(A.token, 'GET', 'songs?id=eq.' + tag + '-song');
    ok(rows(r).length === 1 && rows(r)[0].data.name === 'rahasia A', 'data A tetap utuh setelah percobaan B');

    // ---- bersihkan yang boleh dihapus klien ----
    await api(A.token, 'DELETE', 'songs?id=eq.' + tag + '-song');
    console.log('\nCatatan: sesi/lencana uji "' + tag + '-*" tersisa (append-only). Hapus lewat SQL Editor (lihat komentar di atas file).');

    // ---- opsional: hapus akun B ----
    if (process.argv.includes('--hapus-akun-b')) {
        r = await api(B.token, 'POST', 'sessions', sess(tag + '-b-s'));
        ok(r.status === 201, 'B punya data sebelum akun dihapus');
        const d = await fetch(URL_ + '/rest/v1/rpc/delete_my_account', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + B.token, 'Content-Type': 'application/json' }, body: '{}' });
        ok(d.status === 204 || d.status === 200, 'B menjalankan delete_my_account (status ' + d.status + ')');
        const g = await fetch(URL_ + '/rest/v1/sessions?id=eq.' + tag + '-b-s', { headers: { apikey: KEY, Authorization: 'Bearer ' + A.token } });
        ok(g.status === 200 && (await g.json()).length === 0, 'baris B hilang setelah akun dihapus (cek dari sisi A tidak menjangkaunya)');
        ok((await api(A.token, 'GET', 'settings?user_id=eq.' + A.id)).status === 200, 'akun A tidak terpengaruh');
        console.log('Cek manual: di Supabase (Authentication -> Users dan Table Editor) pastikan akun B dan semua barisnya sudah tidak ada.');
        const anon = await fetch(URL_ + '/rest/v1/rpc/delete_my_account', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: '{}' });
        ok(anon.status >= 400, 'fungsi delete_my_account tidak bisa dipanggil tanpa login (status ' + anon.status + ')');
    }
    console.log(fails ? `\n${fails} tes gagal: JANGAN buka ke pengguna sebelum diperbaiki` : '\nSemua tes RLS lulus');
    process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
