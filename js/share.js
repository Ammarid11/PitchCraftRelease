/* Pitchcraft — Kartu bagikan (roadmap #8): gambar progresi, skor latihan, atau hasil ronde Latih Telinga lewat <canvas>, lalu Web Share API (cadangan: unduh PNG).
 * Lapisan tampilan saja: tidak menyentuh deteksi nada/akor, dan tidak mengirim apa pun ke server (gambar dibuat di perangkat). */

const SC_W = 1080, SC_H = 1920;
const SC_DISP = '"Space Grotesk","Plus Jakarta Sans",system-ui,sans-serif', SC_BODY = '"Plus Jakarta Sans",system-ui,sans-serif';
const SC_LVL = { dasar: 'Dasar', barre: 'Barre', seventh: '7th & sus' };
let scBlob = null, scFile = null, scCaption = '', scUrl = '';

function scRR(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
}

// teks; o.max = lebar maksimum (huruf dikecilkan otomatis agar muat)
function scT(c, t, x, y, size, color, o) {
    o = o || {}; const f = o.f || SC_BODY, w = o.w || 600; t = String(t);
    c.font = w + ' ' + size + 'px ' + f;
    if (o.max) while (size > 18 && c.measureText(t).width > o.max) { size -= 2; c.font = w + ' ' + size + 'px ' + f; }
    c.fillStyle = color; c.textAlign = o.a || 'left'; c.textBaseline = 'alphabetic'; c.fillText(t, x, y);
    return size;
}

// "pil" informasi; mengembalikan x berikutnya
function scChip(c, x, y, text) {
    c.font = '600 30px ' + SC_BODY;
    const w = Math.min(920, c.measureText(text).width + 56);
    c.fillStyle = 'rgba(255,255,255,.07)'; scRR(c, x, y, w, 64, 32); c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.14)'; c.stroke();
    scT(c, text, x + 28, y + 43, 30, '#e2e8f0', { max: w - 56 });
    return x + w + 16;
}

function scStat(c, x, y, w, h, val, label, color) {
    c.fillStyle = 'rgba(255,255,255,.05)'; scRR(c, x, y, w, h, 28); c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.1)'; c.stroke();
    scT(c, val, x + w / 2, y + h * 0.55, 72, color || '#fff', { f: SC_DISP, w: 700, a: 'center', max: w - 36 });
    scT(c, label, x + w / 2, y + h - 34, 26, '#8391a7', { a: 'center' });
}

// latar, logo, label kartu, dan kaki halaman yang sama di semua kartu
function scBase(label) {
    const cv = document.createElement('canvas'); cv.width = SC_W; cv.height = SC_H;
    const c = cv.getContext('2d');
    c.fillStyle = '#090a0f'; c.fillRect(0, 0, SC_W, SC_H);
    let g = c.createRadialGradient(SC_W / 2, -80, 40, SC_W / 2, -80, 1150);
    g.addColorStop(0, 'rgba(139,92,246,.55)'); g.addColorStop(1, 'rgba(139,92,246,0)'); c.fillStyle = g; c.fillRect(0, 0, SC_W, SC_H);
    g = c.createRadialGradient(SC_W + 120, 1350, 20, SC_W + 120, 1350, 760);
    g.addColorStop(0, 'rgba(99,102,241,.28)'); g.addColorStop(1, 'rgba(99,102,241,0)'); c.fillStyle = g; c.fillRect(0, 0, SC_W, SC_H);
    const lg = c.createLinearGradient(80, 110, 172, 202); lg.addColorStop(0, '#8b5cf6'); lg.addColorStop(1, '#6366f1');
    c.fillStyle = lg; scRR(c, 80, 110, 92, 92, 26); c.fill();
    scT(c, '♪', 126, 178, 58, '#fff', { a: 'center', w: 700, f: SC_DISP });
    scT(c, 'PITCHCRAFT', 196, 146, 24, '#8391a7', { w: 700 });
    scT(c, 'Ultimate Guitar Chord Master', 196, 186, 34, '#f1f5f9', { f: SC_DISP, w: 700, max: 800 });
    scT(c, label, 80, 330, 30, '#a78bfa', { w: 700 });
    c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(80, 1790, 920, 2);
    scT(c, 'Deteksi akor dari genjrengan nyata · jalan offline', SC_W / 2, 1846, 28, '#8391a7', { a: 'center', max: 920 });
    const host = (/^https?:$/.test(location.protocol) && !/^(localhost|127\.|\[)/.test(location.hostname)) ? location.host : '';
    if (host) scT(c, host, SC_W / 2, 1886, 28, '#c4b5fd', { a: 'center', w: 700, max: 920 });
    return cv;
}

/* ---------- Kartu progresi ---------- */
function scProgression() {
    if (!progression.length) return { err: 'Belum ada progresi. Tambahkan akor dulu di tab Progresi.' };
    const cv = scBase('PROGRESI AKOR'), c = cv.getContext('2d'), capo = getCapo();
    const list = progression.slice(0, 12), n = list.length;
    const bpm = +document.getElementById('bpm').value || 80, pat = strumPatSel || '';
    scT(c, 'Progresi akorku', 80, 430, 84, '#fff', { f: SC_DISP, w: 700, max: 920 });
    let x = scChip(c, 80, 470, document.getElementById('kpSum').textContent);
    x = scChip(c, x, 470, bpm + ' BPM');
    if (x < 820) scChip(c, x, 470, song.meter || '4/4');

    const top = 590, H = 1090, rows = Math.ceil(n / 2), gap = 24;
    const th = Math.min(230, (H - (rows - 1) * gap) / rows), total = rows * th + (rows - 1) * gap, y0 = top + Math.max(0, (H - total) / 4);
    list.forEach((p, i) => {
        const x0 = 80 + (i % 2) * 470, y = y0 + Math.floor(i / 2) * (th + gap), snd = capo ? tKey(p.key, capo) : '';
        c.fillStyle = 'rgba(139,92,246,.16)'; scRR(c, x0, y, 450, th, 28); c.fill();
        c.lineWidth = 2; c.strokeStyle = 'rgba(139,92,246,.7)'; c.stroke();
        scT(c, i + 1, x0 + 28, y + 46, 26, '#8391a7', { w: 700 });
        const sz = Math.min(110, th * 0.5);
        scT(c, p.key, x0 + 225, y + th / 2 + sz * 0.32 - (snd ? 14 : 0), sz, '#fff', { f: SC_DISP, w: 700, a: 'center', max: 400 });
        if (snd) scT(c, 'bunyi ' + snd, x0 + 225, y + th - 30, 26, '#c4b5fd', { a: 'center', max: 400 });
    });
    if (progression.length > n) scT(c, '+' + (progression.length - n) + ' akor lagi', SC_W / 2, 1712, 30, '#8391a7', { a: 'center' });
    if (pat) scT(c, 'Pola strum: ' + pat, SC_W / 2, 1752, 28, '#8391a7', { a: 'center', max: 920 });

    const txt = '| ' + progression.map(p => p.key).join(' | ') + ' |\nBPM ' + bpm + ' · Pitchcraft';
    return { cv, name: 'pitchcraft-progresi.png', text: txt };
}

/* ---------- Kartu skor latihan ---------- */
function scScore() {
    const h = loadHist();
    if (!h.length) return { err: 'Belum ada sesi latihan. Selesaikan satu sesi di tab Latih dulu.' };
    const e = h[h.length - 1], cpm = +e.cpm || 0, ok = +e.ok || 0, bad = +e.bad || 0;
    const best = Math.max.apply(null, h.map(x => +x.cpm || 0)), rec = h.length > 1 && cpm > 0 && cpm >= best;
    const streak = calcStreak(daysOf(getSessions())), have = lsGet('pc_badges', []).length;
    const acc = ok + bad ? Math.round(ok / (ok + bad) * 100) : 0;
    const mode = (MODE_LABEL[e.mode] || 'Latihan') + (e.mode === 'level' && SC_LVL[e.level] ? ' · ' + SC_LVL[e.level] : '');
    const cv = scBase('HASIL LATIHAN'), c = cv.getContext('2d');

    scT(c, mode, 80, 430, 76, '#fff', { f: SC_DISP, w: 700, max: 920 });
    scT(c, new Date(e.t).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), 80, 492, 32, '#8391a7');

    c.save(); c.shadowColor = 'rgba(139,92,246,.85)'; c.shadowBlur = 70;
    scT(c, String(cpm), SC_W / 2, 930, 340, '#fff', { f: SC_DISP, w: 700, a: 'center', max: 900 });
    c.restore();
    scT(c, 'akor per menit', SC_W / 2, 1010, 46, '#c4b5fd', { a: 'center', w: 700 });
    if (rec) {
        c.fillStyle = 'rgba(245,158,11,.16)'; scRR(c, SC_W / 2 - 190, 1050, 380, 68, 34); c.fill();
        c.lineWidth = 2; c.strokeStyle = 'rgba(245,158,11,.7)'; c.stroke();
        scT(c, '🏆 Rekor pribadi', SC_W / 2, 1096, 32, '#fcd34d', { a: 'center', w: 700 });
    }
    scStat(c, 80, 1190, 290, 190, ok, 'benar', '#6ee7b7');
    scStat(c, 395, 1190, 290, 190, bad, 'salah', '#fca5a5');
    scStat(c, 710, 1190, 290, 190, acc + '%', 'akurasi');
    scStat(c, 80, 1410, 290, 190, e.dur + ' dtk', 'durasi');
    scStat(c, 395, 1410, 290, 190, '🔥 ' + streak, 'hari beruntun');
    scStat(c, 710, 1410, 290, 190, have + '/' + BADGES.length, 'lencana');

    const txt = 'Latihan Pitchcraft (' + mode + '): ' + cpm + ' akor/menit, benar ' + ok + ' dari ' + (ok + bad) + ' 🎸';
    return { cv, name: 'pitchcraft-skor.png', text: txt };
}

/* ---------- Kartu hasil Latih Telinga ---------- */
function scEar() {
    const d = typeof earData === 'function' ? earData() : {}, L = d.last;
    if (!L || !L.kind) return { err: 'Belum ada ronde Latih Telinga. Selesaikan satu ronde di tab Latih dulu.' };
    const ok = +L.ok || 0, bad = +L.bad || 0, tot = ok + bad || 1, acc = Math.round(ok / tot * 100);
    const kn = ((typeof EAR_KINDS !== 'undefined' && EAR_KINDS.find(k => k[0] === L.kind)) || [0, 'Latih Telinga'])[1];
    const lb = (typeof earLabels === 'function' ? earLabels(L.kind) : {})[L.level] || L.level;
    const streak = calcStreak(daysOf(getSessions())), have = lsGet('pc_badges', []).length;
    const cv = scBase('LATIH TELINGA'), c = cv.getContext('2d');

    scT(c, kn, 80, 430, 76, '#fff', { f: SC_DISP, w: 700, max: 920 });
    scT(c, lb, 80, 492, 32, '#c4b5fd', { max: 920, w: 700 });
    scT(c, new Date(L.t || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), 80, 540, 28, '#8391a7');

    c.save(); c.shadowColor = 'rgba(139,92,246,.85)'; c.shadowBlur = 70;
    scT(c, ok + '/' + tot, SC_W / 2, 930, 320, '#fff', { f: SC_DISP, w: 700, a: 'center', max: 900 });
    c.restore();
    scT(c, 'tebakan benar', SC_W / 2, 1010, 46, '#c4b5fd', { a: 'center', w: 700 });
    if (L.best) {
        c.fillStyle = 'rgba(245,158,11,.16)'; scRR(c, SC_W / 2 - 190, 1050, 380, 68, 34); c.fill();
        c.lineWidth = 2; c.strokeStyle = 'rgba(245,158,11,.7)'; c.stroke();
        scT(c, '🏆 Rekor pribadi', SC_W / 2, 1096, 32, '#fcd34d', { a: 'center', w: 700 });
    }
    scStat(c, 80, 1190, 290, 190, ok, 'benar', '#6ee7b7');
    scStat(c, 395, 1190, 290, 190, bad, 'salah', '#fca5a5');
    scStat(c, 710, 1190, 290, 190, acc + '%', 'akurasi');
    scStat(c, 80, 1410, 290, 190, (+L.dur || 0) + ' dtk', 'durasi');
    scStat(c, 395, 1410, 290, 190, '🔥 ' + streak, 'hari beruntun');
    scStat(c, 710, 1410, 290, 190, have + '/' + BADGES.length, 'lencana');

    const txt = 'Latih Telinga Pitchcraft (' + kn + ' · ' + lb + '): ' + ok + ' dari ' + tot + ' benar 👂';
    return { cv, name: 'pitchcraft-telinga.png', text: txt };
}

/* ---------- Pratinjau, bagikan, unduh ---------- */
async function scOpen(kind) {
    try {   // tunggu huruf Google Fonts (kalau ada) supaya kartu tidak memakai huruf cadangan
        if (document.fonts && document.fonts.load) await Promise.race([
            Promise.all([document.fonts.load('700 40px "Space Grotesk"'), document.fonts.load('600 30px "Plus Jakarta Sans"')]),
            new Promise(r => setTimeout(r, 800))]);
    } catch (e) { }
    let r; try { r = kind === 'score' ? scScore() : kind === 'ear' ? scEar() : scProgression(); } catch (e) { console.error(e); alert('Gagal membuat kartu: ' + (e.message || e)); return; }
    if (r.err) { alert(r.err); return; }
    const blob = await new Promise(res => { try { r.cv.toBlob(res, 'image/png'); } catch (e) { res(null); } });
    if (!blob) { alert('Gagal membuat gambar di browser ini.'); return; }
    if (scUrl) URL.revokeObjectURL(scUrl);
    scBlob = blob; scUrl = URL.createObjectURL(blob); scCaption = r.text;
    try { scFile = new File([blob], r.name, { type: 'image/png' }); } catch (e) { scFile = null; }   // File() tidak ada di browser sangat lama
    scFileName = r.name;
    document.getElementById('scImg').src = scUrl;
    document.getElementById('share').classList.add('on');
}
let scFileName = 'pitchcraft.png';

function scClose() {
    document.getElementById('share').classList.remove('on');
    document.getElementById('scImg').removeAttribute('src');
    if (scUrl) { URL.revokeObjectURL(scUrl); scUrl = ''; }
}

function scSave() {
    if (!scBlob) return;
    const a = document.createElement('a'); a.href = scUrl; a.download = scFileName;
    document.body.appendChild(a); a.click(); a.remove();
    pcToast('Gambar diunduh');
}

async function scShare() {
    if (!scBlob) return;
    try {
        if (scFile && navigator.canShare && navigator.canShare({ files: [scFile] })) {
            await navigator.share({ files: [scFile], text: scCaption }); return;
        }
    } catch (e) { if (e && e.name === 'AbortError') return; }   // dibatalkan pengguna: diam saja; gagal lain: jatuh ke unduhan
    scSave();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = document.getElementById('share'); if (m && m.classList.contains('on')) scClose(); } });
