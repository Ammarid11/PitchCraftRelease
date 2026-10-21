/* Pitchcraft — Animasi jari saat pindah akor (roadmap #7).
 * Membandingkan bentuk jari akor A dan B (data dari analyzeFingers): jari yang tetap di tempat (hijau), berpindah (ungu),
 * diangkat (merah) dan baru diletakkan (biru). Lapisan tampilan saja: tidak menyentuh deteksi nada/akor.
 * Animasi digerakkan CSS lewat atribut data-ph (0 = akor A, 1 = akor B) pada pembungkus, jadi tidak ada loop gambar ulang. */

let mvA = { key: 'G', v: 0 }, mvB = { key: 'C', v: 0 }, mvPhase = 0, mvTimer = null, mvPair = 0;
const MVG = { x0: 30, dx: 20, y0: 34, dy: 24 };
const mvEl = id => document.getElementById(id);

function mvDots(key, v) {
    const c = chordDatabase[key]; if (!c) return null;
    const raw = (c.variants[v] || c.variants[0]).fingering, f = adaptFingering(raw), a = analyzeFingers(f);
    return { key, raw, f, fing: a.fing, barre: a.barre };
}

// Rencana perpindahan: jari di senar & fret yang sama = tetap; sisanya dipasangkan (nomor jari sama dan jarak terdekat dulu)
function mvPlan(A, B) {
    const dots = d => d.f.map((fr, s) => fr > 0 ? { s, fr, n: d.fing[s] || fr } : null).filter(Boolean);
    const da = dots(A), rb = dots(B).slice(), stay = [], ra = [];
    da.forEach(a => {
        const i = rb.findIndex(b => b.s === a.s && b.fr === a.fr);
        if (i >= 0) { stay.push({ s: a.s, fr: a.fr, an: a.n, bn: rb[i].n }); rb.splice(i, 1); } else ra.push(a);
    });
    const pairs = [];
    ra.forEach((a, i) => rb.forEach((b, j) => pairs.push({ i, j, c: (a.n === b.n ? 0 : 8) + Math.abs(a.s - b.s) + Math.abs(a.fr - b.fr) })));
    pairs.sort((p, q) => p.c - q.c);
    const ua = new Set(), ub = new Set(), move = [];
    pairs.forEach(p => { if (ua.has(p.i) || ub.has(p.j)) return; ua.add(p.i); ub.add(p.j); move.push({ a: ra[p.i], b: rb[p.j] }); });
    return { stay, move, out: ra.filter((_, i) => !ua.has(i)), inn: rb.filter((_, j) => !ub.has(j)) };
}

function mvSvg(A, B, P) {
    const g = MVG, lefty = document.body.classList.contains('lefty');
    const all = A.f.concat(B.f).filter(v => v > 0), minF = all.length ? Math.min.apply(null, all) : 1, maxF = all.length ? Math.max.apply(null, all) : 1;
    const start = maxF <= 5 ? 1 : minF, rows = Math.min(8, Math.max(5, maxF - start + 1));
    const sx = s => g.x0 + (lefty ? 5 - s : s) * g.dx, cy = fr => g.y0 + (fr - start) * g.dy + g.dy / 2;
    const names = tuningInfo().t.map((m, i) => i === 5 ? noteStrings[m % 12].toLowerCase() : noteStrings[m % 12]);
    const bot = g.y0 + rows * g.dy;
    let h = '';
    for (let i = 0; i <= rows; i++) h += `<line x1="${g.x0}" y1="${g.y0 + i * g.dy}" x2="${g.x0 + 5 * g.dx}" y2="${g.y0 + i * g.dy}" stroke="#475069" stroke-width="${i === 0 && start === 1 ? 5 : 1.5}"/>`;
    for (let s = 0; s < 6; s++) h += `<line x1="${sx(s)}" y1="${g.y0}" x2="${sx(s)}" y2="${bot}" stroke="#475069" stroke-width="1.5"/><text x="${sx(s)}" y="${bot + 14}" font-size="9" fill="#8391a7" text-anchor="middle">${names[s]}</text>`;
    if (start > 1) h += `<text x="${g.x0 - 8}" y="${g.y0 + g.dy / 2 + 4}" font-size="11" fill="#8391a7" text-anchor="end">${start}</text>`;
    // penanda senar mati (×) / terbuka (○) dan barre: satu set per akor, bergantian menurut fase
    [A, B].forEach((d, p) => {
        let m = '';
        d.f.forEach((v, s) => {
            if (v === -1) m += `<text x="${sx(s)}" y="${g.y0 - 9}" font-size="13" fill="#ef4444" text-anchor="middle">×</text>`;
            else if (v === 0) m += `<circle cx="${sx(s)}" cy="${g.y0 - 13}" r="4" fill="none" stroke="#10b981" stroke-width="1.5"/>`;
        });
        const b = d.barre;
        if (b && b.fret - start >= 0 && b.fret - start < rows) {
            const xa = Math.min(sx(b.from), sx(b.to)), xb = Math.max(sx(b.from), sx(b.to));
            m += `<rect x="${xa - 7}" y="${g.y0 + (b.fret - start) * g.dy + 4}" width="${xb - xa + 14}" height="${g.dy - 8}" rx="8" fill="#8b5cf6" fill-opacity=".5"/>`;
        }
        h += `<g class="ph${p}">${m}</g>`;
    });
    const dot = (fill, n0, n1, extra) => `<circle r="8.5" fill="${fill}" style="fill:${fill}" stroke="#fff" stroke-opacity=".9" stroke-width="1.2" ${extra || ''}/>` +
        `<text class="ph0" y="3.5" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">${n0}</text><text class="ph1" y="3.5" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">${n1}</text>`;
    P.stay.forEach(d => { h += `<g transform="translate(${sx(d.s)},${cy(d.fr)})">${dot('#10b981', d.an, d.bn)}</g>`; });
    P.out.forEach(d => { h += `<g class="mv-out" transform="translate(${sx(d.s)},${cy(d.fr)})">${dot('#ef4444', d.n, d.n, 'fill-opacity=".6"')}</g>`; });
    P.inn.forEach(d => { h += `<g class="mv-in" transform="translate(${sx(d.s)},${cy(d.fr)})">${dot('#38bdf8', d.n, d.n)}</g>`; });
    P.move.forEach(m => { h += `<g class="mv-move" transform="translate(${sx(m.a.s)},${cy(m.a.fr)})" style="--ax:${sx(m.a.s)}px;--ay:${cy(m.a.fr)}px;--bx:${sx(m.b.s)}px;--by:${cy(m.b.fr)}px">${dot('#8b5cf6', m.a.n, m.b.n)}</g>`; });
    return `<svg class="mv-svg" viewBox="0 0 160 ${bot + 22}" role="img" aria-label="Perpindahan jari dari ${esc(A.key)} ke ${esc(B.key)}">${h}</svg>`;
}

function mvInfoHTML(A, B, P) {
    if (A.key === B.key && A.raw.join() === B.raw.join()) return 'Kedua akor sama, jadi tidak ada jari yang berpindah. Pilih akor tujuan yang berbeda.';
    const str = d => 'senar ' + (6 - d.s) + ', fret ' + d.fr;
    const dot = c => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:${c}"></span>`;
    let h = `${dot('#10b981')}<strong>${P.stay.length}</strong> jari tetap · ${dot('#8b5cf6')}<strong>${P.move.length}</strong> berpindah · ${dot('#ef4444')}${P.out.length} diangkat · ${dot('#38bdf8')}${P.inn.length} diletakkan`;
    P.move.forEach(m => { h += `<br>${dot('#8b5cf6')}Jari ${m.a.n}: ${str(m.a)} → ${str(m.b)}`; });
    P.out.forEach(d => { h += `<br>${dot('#ef4444')}Angkat jari ${d.n} (${str(d)})`; });
    P.inn.forEach(d => { h += `<br>${dot('#38bdf8')}Letakkan jari ${d.n} (${str(d)})`; });
    if (P.stay.length) h += '<br><em>Biarkan jari hijau tetap di tempatnya saat pindah; itu yang membuat perpindahan terasa cepat.</em>';
    return h;
}

function mvRender() {
    const st = mvEl('mvStage'); if (!st) return;
    const A = mvDots(mvA.key, mvA.v), B = mvDots(mvB.key, mvB.v);
    if (!A || !B) { st.innerHTML = '<span class="empty-list">Pilih dua akor.</span>'; mvEl('mvInfo').innerHTML = ''; return; }
    const P = mvPlan(A, B);
    st.innerHTML = `<div class="mv-wrap" data-ph="${mvPhase}" role="button" tabindex="0" aria-label="Ketuk untuk berganti antara kedua akor" onclick="mvFlip()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();mvFlip()}">` +
        `<div class="mv-title"><b class="mv-a">${esc(A.key)}</b><span>→</span><b class="mv-b">${esc(B.key)}</b></div>${mvSvg(A, B, P)}</div>`;
    mvEl('mvInfo').innerHTML = mvInfoHTML(A, B, P);
    mvEl('mvFrom').value = mvA.key; mvEl('mvTo').value = mvB.key;
}

function mvPick() { mvA = { key: mvEl('mvFrom').value, v: 0 }; mvB = { key: mvEl('mvTo').value, v: 0 }; mvRender(); }
function mvSwap() { const t = mvA; mvA = mvB; mvB = t; mvRender(); }
function mvNextPair() {
    if (progression.length < 2) { pcToast('Tambahkan minimal 2 akor ke Progresi dulu'); return; }
    const n = progression.length, i = mvPair % n, a = progression[i], b = progression[(i + 1) % n];
    mvPair = i + 1; mvA = { key: a.key, v: a.v | 0 }; mvB = { key: b.key, v: b.v | 0 }; mvRender();
}
function mvFlip() {
    mvPhase ^= 1;
    const w = document.querySelector('#mvStage .mv-wrap'); if (w) w.setAttribute('data-ph', mvPhase);
    const snd = mvEl('mvSnd');
    if (snd && snd.checked) { const s = mvPhase ? mvB : mvA, d = mvDots(s.key, s.v); if (d) try { playChordFingering(d.raw); } catch (e) { } }
}
function mvStop() {
    clearInterval(mvTimer); mvTimer = null;
    const b = mvEl('mvPlayBtn'); if (b) { b.textContent = '▶ Putar animasi'; b.classList.remove('is-on'); }
}
function mvToggle() {
    if (mvTimer) { mvStop(); return; }
    const b = mvEl('mvPlayBtn'); b.textContent = '■ Hentikan'; b.classList.add('is-on');
    mvTimer = setInterval(() => { if (window.curTab !== 'progresi') { mvStop(); return; } mvFlip(); }, 1700);
}

function mvInit() {
    const f = mvEl('mvFrom'), t = mvEl('mvTo'); if (!f || !t) return;
    const keys = Object.keys(chordDatabase), opt = k => `<option>${esc(k)}</option>`;
    f.innerHTML = t.innerHTML = `<optgroup label="Akor umum">${keys.filter(k => !chordDatabase[k].ext).map(opt).join('')}</optgroup><optgroup label="Lanjutan &amp; slash">${keys.filter(k => chordDatabase[k].ext).map(opt).join('')}</optgroup>`;
    mvRender();
}

// tuning / diagram / kidal berubah -> gambar ikut diperbarui
const _rcvMv = refreshChordViews;
refreshChordViews = function () { _rcvMv(); mvRender(); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') mvStop(); });
mvInit();
