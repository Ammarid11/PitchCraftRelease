/* Pitchcraft — Efek tampilan: riak (ripple) saat tombol ditekan, penanda visual tombol yang sedang aktif, animasi masuk tiap tab.
 * Lapisan tampilan saja; tidak menyentuh deteksi nada/akor. Animasi otomatis mati bila perangkat memakai "kurangi gerakan". */

// tombol yang mendapat riak (tab bawah punya efek tekan sendiri di CSS)
const FX_SEL = '.btn-primary,.btn-secondary,.btn-audio,.btn-variant,.btn-delete-saved,.chip,.lib-act button,.lib-var button,.cp-add,.cp-ply,.keypill,.kp-x,.ac-google,.chgrid button,.tip button';
const fxReduce = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

document.addEventListener('pointerdown', e => {
    if (fxReduce() || (e.button !== undefined && e.button > 0)) return;
    const t = e.target && e.target.closest ? e.target.closest(FX_SEL) : null;
    if (!t || t.disabled) return;
    const r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('span');
    s.className = 'fx-rip'; s.style.width = s.style.height = d + 'px';
    s.style.left = (e.clientX - r.left) + 'px'; s.style.top = (e.clientY - r.top) + 'px';
    t.appendChild(s); setTimeout(() => s.remove(), 650);
}, { passive: true });

// Tombol berstatus ditandai data-tg: lefty, diag, imp = tombol nyala/mati; play = sedang memutar
function fxSync() {
    const set = (k, v, aria) => document.querySelectorAll('[data-tg="' + k + '"]').forEach(b => {
        b.classList.toggle('is-on', !!v); if (aria) b.setAttribute('aria-pressed', v ? 'true' : 'false');
    });
    const ib = document.getElementById('impBox');
    set('lefty', document.body.classList.contains('lefty'), true);
    set('diag', typeof diagramMode !== 'undefined' && diagramMode === 'v', true);
    set('imp', !!ib && !ib.hidden, true);
    set('play', typeof progTimers !== 'undefined' && progTimers.length > 0, false);
}
document.addEventListener('click', () => setTimeout(fxSync, 0));
setInterval(fxSync, 400);   // menangkap perubahan dari luar klik: pengaturan dimuat, sinkron akun, putaran selesai sendiri
fxSync();

// kartu di tab yang baru dibuka muncul berurutan
function fxStagger() { document.querySelectorAll('.card.on').forEach((c, i) => c.style.setProperty('--d', Math.min(i, 5) * 70 + 'ms')); }
const _showTabFx = showTab;
showTab = function (n) { _showTabFx(n); fxStagger(); };
fxStagger();
