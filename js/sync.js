/* Pitchcraft — Akun & sinkron (Supabase). Offline-first: localStorage tetap sumber utama, server hanya salinan.
 * Yang dikirim: sesi latihan, lencana, lagu aktif, pengaturan + progresi. Audio mikrofon TIDAK pernah dikirim.
 * Isi js/supabase-config.js agar aktif; tanpa itu app berjalan seperti biasa tanpa login. */

const PCS = window.PC_SUPABASE || {};
const sbOn = !!(PCS.url && PCS.anonKey);
let sb = null, sbUser = null, syncing = false, syncAgain = false, syncT = null, lastSyncAt = 0, syncMsg = '';
let syncState = '', acctBusy = '', acctSentTo = '', acctCool = 0, acctErr = '', acctEmailVal = '', acctAdv = false, sbErr = '', acctTickT = null;
const getSync = () => lsGet('pc_sync', {});
const setSync = o => lsSet('pc_sync', o);
const knownBadges = () => new Set((typeof BADGES !== 'undefined' ? BADGES : []).map(b => b[0]));

/* ---------- Data lokal yang disinkronkan ---------- */
const songHasContent = () => !!(song.name || song.sections.some(s => s.lyrics || s.chords.length));
function settingsData() { const d = collectSettings(); delete d.song; return d; }   // lagu di baris terpisah
const docLocal = kind => kind === 'song' ? cleanSong(song) : settingsData();

function applyRemoteDoc(kind, data) {
    if (!data || typeof data !== 'object') return;
    if (kind === 'song') {
        song = cleanSong(data); if (!song.sections.length) song.sections = [newSection()];
        renderSong(); return;
    }
    try { localStorage.setItem(PC_KEY, JSON.stringify(Object.assign({}, data, { song }))); } catch (e) { }
    loadSettings();
    try { renderTuning(); renderKey(); renderPat(); renderProgression(); renderSong(); refreshChordViews(); } catch (e) { console.error(e); }
}

function stashConflict(kind, local) {
    const c = lsGet('pc_conflicts', {}); c[kind] = { at: Date.now(), data: local }; lsSet('pc_conflicts', c);
}
function restoreConflict(kind) {
    const c = lsGet('pc_conflicts', {}), x = c[kind]; if (!x) return;
    applyRemoteDoc(kind, x.data); delete c[kind]; lsSet('pc_conflicts', c);   // beda dari rec.hash -> terdorong ke server pada sinkron berikut
    renderAcct(); pcToast('Versi perangkat ini dipulihkan'); pcSyncSoon();
}

/* ---------- Mesin sinkron (db = adapter; bisa diganti server palsu saat uji) ---------- */
async function syncDoc(db, uid, kind, st) {
    const rec = st[kind] = st[kind] || {};
    for (let attempt = 0; attempt < 3; attempt++) {
        const local = docLocal(kind), lh = hashStr(canon(local)), meaningful = kind === 'settings' || songHasContent();
        const remote = await db.getDoc(kind, kind === 'song' ? rec.id : null);
        if (!remote) {
            if (!meaningful) return;
            const id = kind === 'song' ? (rec.id || newId()) : uid;
            const row = kind === 'song' ? { id, user_id: uid, data: local } : { user_id: uid, data: local, schema_version: typeof SETTINGS_V !== 'undefined' ? SETTINGS_V : 1 };
            let ua; try { ua = await db.insertDoc(kind, row); } catch (e) { if (e && e.code === '23505') continue; throw e; }   // perangkat lain baru saja mengisi: ulangi sebagai pembaruan
            if (kind === 'song') rec.id = id;
            rec.base = ua; rec.hash = lh; return;
        }
        if (kind === 'song' && !rec.id) rec.id = remote.id;
        const remoteChanged = !rec.base || remote.updated_at !== rec.base;
        const localChanged = rec.hash ? lh !== rec.hash : meaningful;
        if (!remoteChanged && !localChanged) return;
        if (!remoteChanged) {   // hanya lokal berubah -> dorong; ditolak bila server berubah di sela-sela (cek updated_at)
            const ua = await db.updateDoc(kind, kind === 'song' ? rec.id : uid, local, rec.base);
            if (ua === null) continue;
            rec.base = ua; rec.hash = lh; return;
        }
        const cleanRemote = kind === 'song' ? cleanSong(remote.data || {}) : remote.data;
        const worth = kind === 'song' || (local.progression || []).length > 0;   // perangkat baru punya pengaturan bawaan: jangan dianggap konflik
        if (localChanged && worth && canon(cleanRemote) !== canon(local)) {   // dua sisi berubah, isi berbeda: simpan versi lokal, pakai versi server
            stashConflict(kind, local);
            pcToast('Konflik ' + (kind === 'song' ? 'lagu' : 'pengaturan') + ': versi perangkat ini disimpan, buka 👤 Akun untuk memulihkan');
        }
        if (!localChanged || canon(cleanRemote) !== canon(local)) applyRemoteDoc(kind, remote.data);
        rec.base = remote.updated_at; rec.hash = hashStr(canon(docLocal(kind)));
        return;
    }
    throw new Error('server sibuk, coba lagi');
}

async function syncOnce(db, uid) {
    const st = getSync(); st.uid = uid;
    // 1) sesi: tarik yang baru dari server (kursor waktu server, tumpang tindih 2 menit; dedupe berdasarkan ID), lalu dorong yang belum terkirim
    let ss = getSessions();
    const since = st.cur ? new Date(Date.parse(st.cur) - 120000).toISOString() : '1970-01-01T00:00:00.000Z';
    const rows = await db.sessionsSince(since), byId = new Map(ss.map(s => [s.id, s]));
    let maxC = st.cur ? Date.parse(st.cur) : 0;
    rows.forEach(r => {
        const t = Date.parse(r.created_at); if (t > maxC) maxC = t;
        const c = cleanSession(r); if (!c) return;
        if (byId.has(c.id)) byId.get(c.id).s = 1; else { c.s = 1; ss.push(c); byId.set(c.id, c); }
    });
    const un = ss.filter(s => !s.s);
    for (let i = 0; i < un.length; i += 200) {
        const chunk = un.slice(i, i + 200);
        await db.upsertSessions(chunk.map(s => ({ id: s.id, user_id: uid, mode: s.mode, level: s.level, dur: s.dur, ok: s.ok, bad: s.bad, cpm: s.cpm, played_at: s.played_at, day: s.day })));
        chunk.forEach(s => { s.s = 1; });
    }
    setSessions(ss); if (maxC) st.cur = new Date(maxC).toISOString(); setSync(st);
    // 2) lencana: gabungan (lencana yang sudah diraih tidak dicabut)
    const known = knownBadges(), remoteB = (await db.badgesAll()).filter(b => known.has(b));
    const localB = new Set(lsGet('pc_badges', []).filter(b => known.has(b))), rs = new Set(remoteB);
    const missing = [...localB].filter(b => !rs.has(b));
    if (missing.length) await db.upsertBadges(missing.map(b => ({ user_id: uid, badge_id: b })));
    remoteB.forEach(b => localB.add(b)); lsSet('pc_badges', [...localB]);
    st.bd = hashStr([...localB].sort().join(',')); setSync(st);
    // 2b) catatan akor salah: append-only seperti sesi (kursor waktu server), simpan 300 terbaru di perangkat
    const ms = getMisses(), mby = new Map(ms.map(m => [m.id, m]));
    const msince = st.mcur ? new Date(Date.parse(st.mcur) - 120000).toISOString() : '1970-01-01T00:00:00.000Z';
    let mmax = st.mcur ? Date.parse(st.mcur) : 0;
    (await db.missesSince(msince)).forEach(r => {
        const t = Date.parse(r.created_at); if (t > mmax) mmax = t;
        const c = cleanMiss(r); if (!c) return;
        if (mby.has(c.id)) mby.get(c.id).s = 1; else { c.s = 1; ms.push(c); mby.set(c.id, c); }
    });
    const mun = ms.filter(m => !m.s);
    for (let i = 0; i < mun.length; i += 200) {
        const chunk = mun.slice(i, i + 200);
        await db.upsertMisses(chunk.map(m => ({ id: m.id, user_id: uid, want: m.want, got: m.got, happened_at: new Date(m.t).toISOString() })));
        chunk.forEach(m => { m.s = 1; });
    }
    ms.sort((a, b) => a.t - b.t); setMisses(ms.slice(-300)); if (mmax) st.mcur = new Date(mmax).toISOString(); setSync(st);
    // 3) lagu dan pengaturan
    await syncDoc(db, uid, 'song', st); setSync(st);
    await syncDoc(db, uid, 'settings', st);
    st.at = Date.now(); setSync(st);
    renderStreak();
}

function hasLocalChanges() {
    const st = getSync(); if (!st.at) return true;
    if (getSessions().some(s => !s.s)) return true;
    if (getMisses().some(m => !m.s)) return true;
    if (hashStr([...new Set(lsGet('pc_badges', []))].sort().join(',')) !== st.bd) return true;
    const s1 = st.song || {}, s2 = st.settings || {};
    const sh = hashStr(canon(docLocal('song')));
    return (s1.hash ? sh !== s1.hash : songHasContent()) || hashStr(canon(docLocal('settings'))) !== s2.hash;
}

function pcSyncSoon() { if (!sbUser || !sb) return; clearTimeout(syncT); syncT = setTimeout(() => runSync(false), 4000); }
async function runSync(force) {
    if (!sbUser || !sb) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { syncState = 'offline'; syncMsg = 'Offline: akan disinkron saat online'; renderAcct(); return; }
    if (syncing) { syncAgain = true; return; }
    if (!force && !hasLocalChanges()) return;
    syncing = true; syncState = 'syncing'; syncMsg = 'Menyinkron…'; renderAcct();
    try { await syncOnce(dbReal(sbUser.id), sbUser.id); lastSyncAt = Date.now(); syncState = 'ok'; syncMsg = 'Tersinkron pukul ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { console.error(e); syncState = 'err'; syncMsg = 'Gagal sinkron: ' + acctFriendly(e); }
    finally { syncing = false; renderAcct(); if (syncAgain) { syncAgain = false; pcSyncSoon(); } }
}
window.pcSyncSoon = pcSyncSoon;
const _saveSettings = saveSettings;
saveSettings = function () { _saveSettings(); pcSyncSoon(); };

/* ---------- Adapter Supabase (tipis; semua aturan ada di engine di atas) ---------- */
function dbReal(uid) {
    const T = { song: 'songs', settings: 'settings' }, ck = (r) => { if (r.error) throw r.error; return r.data; };
    return {
        async getDoc(kind, id) {
            let q = sb.from(T[kind]).select('*');
            if (kind === 'song') q = id ? q.eq('id', id) : q.is('deleted_at', null).order('updated_at', { ascending: false });
            else q = q.eq('user_id', uid);
            const d = ck(await q.limit(1)); return d && d[0] || null;
        },
        async insertDoc(kind, row) { const d = ck(await sb.from(T[kind]).insert(row).select('updated_at')); return d[0].updated_at; },
        async updateDoc(kind, id, data, base) {
            let q = sb.from(T[kind]).update({ data });
            q = kind === 'song' ? q.eq('user_id', uid).eq('id', id) : q.eq('user_id', uid);
            const d = ck(await q.eq('updated_at', base).select('updated_at')); return d.length ? d[0].updated_at : null;
        },
        async sessionsSince(cursor) {
            const out = []; for (let from = 0; ; from += 1000) {
                const d = ck(await sb.from('sessions').select('id,mode,level,dur,ok,bad,cpm,played_at,day,created_at').gt('created_at', cursor)
                    .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, from + 999));
                out.push(...d); if (d.length < 1000) break;
            } return out;
        },
        async upsertSessions(rows) { ck(await sb.from('sessions').upsert(rows, { onConflict: 'user_id,id', ignoreDuplicates: true })); },
        async missesSince(cursor) {
            const out = []; for (let from = 0; ; from += 1000) {
                const d = ck(await sb.from('misses').select('id,want,got,happened_at,created_at').gt('created_at', cursor)
                    .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, from + 999));
                out.push(...d); if (d.length < 1000) break;
            } return out;
        },
        async upsertMisses(rows) { ck(await sb.from('misses').upsert(rows, { onConflict: 'user_id,id', ignoreDuplicates: true })); },
        async badgesAll() { return ck(await sb.from('badges').select('badge_id')).map(r => r.badge_id); },
        async upsertBadges(rows) { ck(await sb.from('badges').upsert(rows, { onConflict: 'user_id,badge_id', ignoreDuplicates: true })); }
    };
}

/* ---------- Login ---------- */
const redirectUrl = () => location.origin + location.pathname;

async function sbLoad() {
    if (sb || !sbOn) return sb;
    if (!window.supabase) await new Promise((res, rej) => {
        const s = document.createElement('script'); s.src = PCS.lib; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat layanan akun')); document.head.appendChild(s);
    });
    sb = window.supabase.createClient(PCS.url, PCS.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    sb.auth.onAuthStateChange((ev, sess) => { setTimeout(() => onAuth(sess && sess.user), 0); });   // jangan await panggilan Supabase di dalam callback ini
    const { data } = await sb.auth.getSession(); onAuth(data.session && data.session.user);
    return sb;
}

function wipeLocal() {
    ['pc_sessions', 'pc_badges', 'pc_days', 'pc_conflicts', 'pc_sync', 'pc_lastlog', 'pc_miss'].forEach(k => { try { localStorage.removeItem(k); } catch (e) { } });
    song = { name: '', meter: '4/4', sections: [newSection()] }; progression = [];
    try { renderSong(); renderProgression(); renderStreak(); } catch (e) { }
}

async function onAuth(user) {
    const prev = sbUser; sbUser = user || null;
    if (!user) { renderAcct(); return; }
    if (prev && prev.id === user.id) { renderAcct(); return; }
    let st = getSync();
    if (st.uid && st.uid !== user.id) {   // ganti akun di perangkat yang sama
        const merge = confirm('Perangkat ini berisi data akun lain.\n\nOK = gabungkan data ini ke akun yang baru masuk\nBatal = hapus data di perangkat ini dan pakai data akun baru');
        if (!merge) wipeLocal();
        setSessions(getSessions().map(s => { const c = Object.assign({}, s); delete c.s; return c; }));   // belum ada di akun baru
    }
    st = { uid: user.id }; setSync(st);
    renderAcct(); runSync(true);
}

function acctFriendly(e) {
    const m = String((e && e.message) || e || '').trim();
    if (/rate limit|too many|over_email_send_rate_limit/i.test(m)) return 'Terlalu sering meminta tautan. Tunggu beberapa menit lalu coba lagi.';
    if (/provider is not enabled|unsupported provider/i.test(m)) return 'Login Google belum diaktifkan di Supabase (Authentication → Providers → Google).';
    if (/manual linking is disabled|manual_linking_disabled/i.test(m)) return 'Penautan akun belum diaktifkan di Supabase: buka pengaturan Authentication dan aktifkan "manual linking".';
    if (/linkunsupported/i.test(m)) return 'Versi pustaka login ini belum mendukung penautan. Naikkan versi supabase-js di js/supabase-config.js.';
    if (/already linked|identity_already_exists|already exists/i.test(m)) return 'Akun Google itu sudah terhubung ke akun Pitchcraft lain, jadi tidak bisa ditautkan di sini.';
    if (/at least 2 identities|single_identity_not_deletable/i.test(m)) return 'Tidak bisa dilepas: akun harus punya minimal dua metode masuk.';
    if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Tidak ada koneksi ke server. Periksa internetmu.';
    return m || 'coba lagi nanti';
}
async function acctEmail(resend) {
    if (acctBusy || Date.now() < acctCool) return;
    const inp = document.getElementById('acctEmail');
    const em = String(resend ? acctSentTo : (inp ? inp.value : acctEmailVal) || '').trim();
    acctEmailVal = em;
    if (!/^\S+@\S+\.\S+$/.test(em)) { acctErr = 'Masukkan alamat email yang valid, mis. nama@contoh.com.'; renderAcct(); return; }
    acctBusy = 'email'; acctErr = ''; renderAcct();
    try {
        await sbLoad(); if (!sb) throw new Error('Layanan akun belum termuat. Periksa koneksi lalu coba lagi.');
        const { error } = await sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: redirectUrl() } });
        if (error) throw error;
        acctSentTo = em; acctCool = Date.now() + 60000;
    } catch (e) { acctErr = 'Tautan gagal dikirim. ' + acctFriendly(e); }
    acctBusy = ''; renderAcct();
}
async function acctGoogle() {
    if (acctBusy) return;
    acctBusy = 'google'; acctErr = ''; renderAcct();
    try {
        await sbLoad(); if (!sb) throw new Error('Layanan akun belum termuat. Periksa koneksi lalu coba lagi.');
        const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl(), queryParams: { prompt: 'select_account' } } });
        if (error) throw error;   // sukses = browser pindah ke halaman Google
    } catch (e) { acctErr = 'Gagal masuk dengan Google. ' + acctFriendly(e); acctBusy = ''; renderAcct(); }
}
const idsOf = () => (sbUser && Array.isArray(sbUser.identities)) ? sbUser.identities : [];
async function acctLink() {
    if (acctBusy) return;
    acctBusy = 'link'; acctErr = ''; renderAcct();
    try {
        await sbLoad(); if (!sb || typeof sb.auth.linkIdentity !== 'function') throw new Error('linkunsupported');
        const { error } = await sb.auth.linkIdentity({ provider: 'google', options: { redirectTo: redirectUrl(), queryParams: { prompt: 'select_account' } } });
        if (error) throw error;   // sukses = browser pindah ke Google, lalu kembali dengan akun tertaut
    } catch (e) { acctErr = 'Gagal menautkan Google. ' + acctFriendly(e); acctBusy = ''; renderAcct(); }
}
async function acctUnlink(i) {
    const ids = idsOf(), id = ids[i]; if (!id || acctBusy) return;
    if (ids.length < 2) { acctErr = acctFriendly('at least 2 identities'); renderAcct(); return; }
    if (!confirm('Lepas metode masuk ' + (id.provider === 'google' ? 'Google' : 'Email') + ' dari akun ini? Datamu tidak dihapus, tapi kamu tidak bisa lagi masuk dengan metode itu.')) return;
    acctBusy = 'unlink'; acctErr = ''; renderAcct();
    try {
        const { error } = await sb.auth.unlinkIdentity(id); if (error) throw error;
        const r = await sb.auth.getUser(); if (r && r.data && r.data.user) sbUser = r.data.user;
        pcToast('Metode masuk dilepas');
    } catch (e) { acctErr = 'Gagal melepas tautan. ' + acctFriendly(e); }
    acctBusy = ''; renderAcct();
}
// kembali dari halaman Google lewat tombol Back (halaman dipulihkan dari cache): lepas status "memproses"
window.addEventListener('pageshow', e => { if (e.persisted && acctBusy) { acctBusy = ''; renderAcct(); } });
async function acctLogout(wipe) {
    if (wipe && !confirm('Keluar dan hapus data latihan, lagu, dan progresi dari perangkat ini? Data di akun tetap aman di server.')) return;
    try { await sb.auth.signOut(); } catch (e) { }
    if (wipe) wipeLocal();
    syncMsg = ''; syncState = ''; renderAcct();
}
async function acctDelete() {
    const t = prompt('Akun dan SEMUA data di server akan dihapus permanen, data di perangkat ini juga. Tidak bisa dibatalkan.\n\nKetik HAPUS untuk melanjutkan:');
    if (t === null || t.trim().toUpperCase() !== 'HAPUS') { if (t !== null) pcToast('Dibatalkan: kata kunci tidak cocok'); return; }
    try {
        const { error } = await sb.rpc('delete_my_account'); if (error) throw error;
        try { await sb.auth.signOut(); } catch (e) { }
        wipeLocal(); renderAcct(); pcToast('Akun dan data server dihapus');
    } catch (e) { alert('Gagal menghapus akun: ' + (e.message || e)); }
}

/* ---------- Cadangan manual (.json) ---------- */
function acctExport() {
    const data = { format: 'pitchcraft-progress', v: 1, exported: new Date().toISOString(),
        sessions: getSessions().map(s => { const c = Object.assign({}, s); delete c.s; return c; }), badges: lsGet('pc_badges', []), misses: getMisses().map(m => ({ id: m.id, t: m.t, want: m.want, got: m.got })), song, settings: settingsData() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'pitchcraft-progres-' + dayKey(new Date()) + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
function importProgress(d) {
    const ss = getSessions(), have = new Set(ss.map(s => s.id)); let n = 0;
    (Array.isArray(d.sessions) ? d.sessions : []).slice(0, 5000).forEach(r => { const c = cleanSession(r); if (c && !have.has(c.id)) { ss.push(c); have.add(c.id); n++; } });
    setSessions(ss);
    const ms = getMisses(), mh = new Set(ms.map(m => m.id));
    (Array.isArray(d.misses) ? d.misses : []).slice(0, 2000).forEach(r => { const c = cleanMiss(r); if (c && !mh.has(c.id)) { ms.push(c); mh.add(c.id); } });
    ms.sort((a, b) => a.t - b.t); setMisses(ms.slice(-300));
    const known = knownBadges(), bg = new Set(lsGet('pc_badges', []));
    (Array.isArray(d.badges) ? d.badges : []).forEach(b => { if (known.has(b)) bg.add(b); }); lsSet('pc_badges', [...bg]);
    if (d.song && Array.isArray(d.song.sections) && confirm('Ganti lagu yang sedang aktif dengan lagu dari file?')) { song = cleanSong(d.song); if (!song.sections.length) song.sections = [newSection()]; renderSong(); }
    renderStreak(); pcToast(n + ' sesi diimpor'); pcSyncSoon();
}
function acctImport(inp) {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (f.size > 5e6) { alert('File terlalu besar.'); inp.value = ''; return; }
    const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result); if (!d || d.format !== 'pitchcraft-progress') throw new Error('bad'); importProgress(d); } catch (e) { alert('File progres tidak valid.'); } inp.value = ''; };
    r.onerror = () => alert('Gagal membaca file.');
    r.readAsText(f);
}

/* ---------- Tampilan akun ---------- */
const G_LOGO = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const fmtDur = s => s < 60 ? s + ' dtk' : s < 3600 ? Math.floor(s / 60) + ' mnt' : Math.floor(s / 3600) + ' jam ' + Math.floor(s % 3600 / 60) + ' mnt';
const acctName = () => { const u = sbUser || {}, m = u.user_metadata || {}; return String(m.full_name || m.name || (u.email ? u.email.split('@')[0] : '') || 'Akun'); };

function acctToggle(open) {
    const m = document.getElementById('acct'); if (!m) return;
    const o = open === undefined ? !m.classList.contains('on') : open;
    m.classList.toggle('on', o); if (o) renderAcct();
}

function acctStats() {
    const ss = getSessions(), days = daysOf(ss), known = knownBadges();
    let streak = 0; try { streak = typeof calcStreak === 'function' ? calcStreak(days) : 0; } catch (e) { }
    return {
        n: ss.length, total: ss.reduce((a, s) => a + (+s.dur || 0), 0), onSrv: ss.filter(s => s.s).length, streak,
        have: lsGet('pc_badges', []).filter(b => known.has(b)).length, all: known.size,
        chords: song.sections.reduce((a, s) => a + s.chords.length, 0),
        saved: typeof savedChordsList !== 'undefined' ? savedChordsList.length : 0
    };
}

function acctDataHTML(st) {
    const at = getSync().at, row = (k, v) => `<div class="ac-row"><span>${k}</span><strong>${v}</strong></div>`;
    return `<h4 class="ac-h">${sbUser ? 'Data kamu' : 'Data di perangkat ini'}</h4>
        <div class="ac-tiles">
            <div class="ac-tile"><b>${st.streak}</b><span>hari beruntun</span></div>
            <div class="ac-tile"><b>${st.n ? fmtDur(st.total) : '0 mnt'}</b><span>total latihan</span></div>
            <div class="ac-tile"><b>${st.n}</b><span>sesi latihan</span></div>
            <div class="ac-tile"><b>${st.have}/${st.all}</b><span>lencana</span></div>
        </div>
        <div class="ac-rows">
            ${row('Lagu aktif', esc(song.name || 'Tanpa judul') + ' · ' + song.sections.length + ' bagian, ' + st.chords + ' akor')}
            ${row('Progresi', progression.length + ' akor')}
            ${row('Akor tersimpan', st.saved)}
            ${sbUser ? row('Sesi di server', st.onSrv + ' dari ' + st.n + (st.n > st.onSrv ? ' (sisanya menunggu sinkron)' : '')) : ''}
            ${sbUser && at ? row('Sinkron terakhir', esc(new Date(at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))) : ''}
        </div>`;
}

function acctLoginHTML() {
    const busy = !!acctBusy, left = Math.max(0, Math.ceil((acctCool - Date.now()) / 1000));
    let h = `<div class="ac-hero"><div class="ac-ico" aria-hidden="true">☁</div><h3>Simpan progresmu</h3>
        <p>Masuk agar streak, lencana, lagu, dan progresi ikut ke HP, laptop, atau perangkat baru.</p></div>
        <ul class="ac-perks"><li>🔄 Sinkron otomatis, tetap jalan tanpa sinyal</li><li>🔒 Suara mikrofon tidak pernah dikirim</li><li>🗑 Akun dan datanya bisa dihapus kapan saja</li></ul>`;
    if (acctErr) h += `<div class="ac-msg err" role="alert">${esc(acctErr)}</div>`;
    else if (sbErr) h += `<div class="ac-msg err" role="alert">Layanan akun belum termuat: ${esc(sbErr)} <button class="btn-variant" onclick="sbErr='';sbLoad().catch(e=>{sbErr=acctFriendly(e);renderAcct()});renderAcct()">Coba lagi</button></div>`;
    h += `<button class="ac-google" onclick="acctGoogle()"${busy ? ' disabled' : ''}>${acctBusy === 'google' ? '<i class="ac-spin"></i>Membuka Google…' : G_LOGO + 'Lanjutkan dengan Google'}</button>
        <div class="ac-or"><span>atau pakai email</span></div>`;
    if (acctSentTo) h += `<div class="ac-msg ok" role="status"><strong>Cek emailmu</strong><br>Tautan masuk dikirim ke <strong>${esc(acctSentTo)}</strong>. Ketuk tautannya untuk masuk. Belum ada? Cek folder spam.
        <div class="picker-row" style="margin-top:10px"><button class="btn-variant" onclick="acctEmail(true)"${left || busy ? ' disabled' : ''}>${left ? 'Kirim ulang dalam ' + left + ' dtk' : 'Kirim ulang tautan'}</button>
        <button class="btn-variant" onclick="acctSentTo='';renderAcct()">Ganti email</button></div></div>`;
    else h += `<div class="ac-mail"><input id="acctEmail" type="email" class="song-in" placeholder="nama@contoh.com" autocomplete="email" inputmode="email" aria-label="Alamat email" value="${esc(acctEmailVal)}" oninput="acctEmailVal=this.value" onkeydown="if(event.key==='Enter')acctEmail()"${busy ? ' disabled' : ''}>
        <button class="btn-primary ac-send" onclick="acctEmail()"${busy ? ' disabled' : ''}>${acctBusy === 'email' ? '<i class="ac-spin"></i>Mengirim…' : 'Kirim tautan masuk'}</button></div>
        <p class="ac-fine">Tanpa kata sandi: kamu menerima tautan sekali pakai.</p>`;
    h += `<p class="ac-fine">Tanpa masuk pun app berjalan penuh. Datamu tetap di perangkat ini.</p>`;
    return h;
}

function acctUserHTML() {
    const em = sbUser.email || '', prov = ((sbUser.app_metadata && sbUser.app_metadata.provider) || 'email') === 'google' ? 'Google' : 'Email', nm = acctName();
    const dot = { syncing: 'busy', ok: 'ok', err: 'err', offline: 'off' }[syncState] || '';
    let h = `<div class="ac-prof"><div class="ac-av" aria-hidden="true">${esc(nm.trim().charAt(0).toUpperCase() || '?')}</div>
        <div class="ac-who"><strong>${esc(nm)}</strong><small>${esc(em)}</small></div><span class="ac-prov">${prov}</span></div>
        <div class="ac-sync" role="status"><i class="ac-dot ${dot}"></i><span>${esc(syncMsg || 'Belum disinkron')}</span></div>
        <div class="picker-row"><button class="btn-variant" onclick="runSync(true)"${syncing ? ' disabled' : ''}>🔄 Sinkron sekarang</button><button class="btn-variant" onclick="acctLogout(false)">Keluar</button></div>`;
    const ids = idsOf();
    if (ids.length) {
        const hasG = ids.some(x => x.provider === 'google'), hasE = ids.some(x => x.provider === 'email');
        h += `<h4 class="ac-h">Metode masuk</h4><div class="ac-ids">` + ids.map((x, i) => {
            const g = x.provider === 'google', mail = x.identity_data && x.identity_data.email || '';
            return `<div class="ac-id"><span class="ac-idi" aria-hidden="true">${g ? G_LOGO : '✉'}</span><div class="ac-who"><strong>${g ? 'Google' : 'Email'}</strong><small>${esc(mail)}</small></div>
                ${ids.length > 1 ? `<button class="btn-variant" onclick="acctUnlink(${i})"${acctBusy ? ' disabled' : ''}>Lepas</button>` : '<span class="ac-prov">Terhubung</span>'}</div>`;
        }).join('') + `</div>`;
        if (!hasG) h += `<button class="ac-google ac-bind" onclick="acctLink()"${acctBusy ? ' disabled' : ''}>${acctBusy === 'link' ? '<i class="ac-spin"></i>Membuka Google…' : G_LOGO + 'Tautkan akun Google'}</button>
            <p class="ac-fine">Setelah ditautkan, kamu bisa masuk dengan Google atau email ke akun yang sama. Datamu tidak berubah. Akun Google yang sudah punya akun Pitchcraft sendiri tidak bisa ditautkan.</p>`;
        else if (!hasE && sbUser.email) h += `<p class="ac-fine">Masuk lewat email dengan alamat <strong>${esc(sbUser.email)}</strong> otomatis memakai akun yang sama.</p>`;
    }
    const cf = lsGet('pc_conflicts', {});
    ['song', 'settings'].forEach(k => { if (cf[k]) h += `<div class="ac-msg warn">Konflik ${k === 'song' ? 'lagu' : 'pengaturan dan progresi'}: versi perangkat ini disimpan (${esc(new Date(cf[k].at).toLocaleString('id-ID'))}). Server memakai versi dari perangkat lain.
        <div class="picker-row" style="margin-top:8px"><button class="btn-variant" onclick="restoreConflict('${k}')">Pakai versi perangkat ini</button></div></div>`; });
    return h;
}

function renderAcct() {
    const pill = document.getElementById('acctBtn'), body = document.getElementById('acctBody'); if (!pill || !body) return;
    pill.textContent = sbUser ? '☁ ' + acctName().slice(0, 10) : '👤 Akun';
    let h = '';
    if (!sbOn) h += '<div class="ac-msg warn">Sinkron akun belum diaktifkan. Isi <code>url</code> dan <code>anonKey</code> di <code>js/supabase-config.js</code>. Sementara itu progres tersimpan di perangkat ini.</div>';
    else h += sbUser ? acctUserHTML() : acctLoginHTML();
    h += acctDataHTML(acctStats());
    h += `<h4 class="ac-h">Cadangan manual</h4>
        <div class="picker-row"><button class="btn-variant" onclick="acctExport()">⬇ Ekspor progres</button><button class="btn-variant" onclick="document.getElementById('acctFile').click()">⬆ Impor progres</button>
        <input type="file" id="acctFile" accept=".json,application/json" hidden onchange="acctImport(this)"></div>`;
    if (sbUser) h += `<details class="ac-adv" ontoggle="acctAdv=this.open"${acctAdv ? ' open' : ''}><summary>Pengaturan lanjutan</summary>
        <div class="picker-row" style="margin-top:10px"><button class="btn-variant" onclick="acctLogout(true)">Keluar dan hapus data di perangkat ini</button></div>
        <div class="ac-danger"><strong>Hapus akun</strong><p>Menghapus akun beserta semua sesi, lencana, lagu, dan pengaturan di server secara permanen.</p><button class="btn-delete-saved" onclick="acctDelete()">Hapus akun dan data server</button></div></details>`;
    h += '<p class="ac-fine" style="margin-top:14px"><a href="privacy.html" target="_blank" rel="noopener">Kebijakan privasi</a></p>';
    body.innerHTML = h;
    clearTimeout(acctTickT);
    if (!sbUser && acctSentTo && acctCool > Date.now()) acctTickT = setTimeout(renderAcct, 1000);   // hitung mundur kirim ulang
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') acctToggle(false); });

/* ---------- Mulai ---------- */
window.addEventListener('online', () => runSync(true));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && sbUser && Date.now() - lastSyncAt > 60000) runSync(true); });
// kembali dari login yang gagal (Supabase menaruh pesan di URL): tampilkan, bersihkan URL, buka dialog
function acctUrlError() {
    try {
        const p = new URLSearchParams(((location.hash || '').replace(/^#/, '')) + '&' + ((location.search || '').replace(/^\?/, '')));
        const d = p.get('error_description') || p.get('error'); if (!d) return;
        acctErr = 'Masuk gagal. ' + acctFriendly(d); history.replaceState(null, '', location.pathname); acctToggle(true);
    } catch (e) { }
}
if (sbOn) { acctUrlError(); sbLoad().catch(e => { sbErr = acctFriendly(e); renderAcct(); }); }
try { renderAcct(); } catch (e) { }
