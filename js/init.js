/* Pitchcraft — Inisialisasi saat halaman dimuat (dijalankan terakhir). */

try { const sv = localStorage.getItem('pc_sens'); if (sv && SENS[sv]) { sensLevel = sv; document.getElementById('sensSel').value = sv; } } catch (e) { }

try { initPicker(); } catch (e) { console.error(e); if (window.pcShow) window.pcShow('Gagal memuat data akor: ' + e.message); }

try {
    document.getElementById('tunSel').innerHTML = Object.keys(TUNINGS).map(k => `<option>${k}</option>`).join('');
    document.getElementById('keyRoot').innerHTML = noteStrings.map((n, i) => `<option value="${i}">${n}${FLAT[n] ? '/' + FLAT[n] : ''}</option>`).join('');
    document.getElementById('capoSel').innerHTML = [0, 1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}">${n || 'tanpa'}</option>`).join('');
    document.getElementById('patSel').innerHTML = Object.keys(STRUM_PATS).map(k => `<option>${k}</option>`).join('');
    renderTuning(); renderKey(); renderPat();
    let t0 = 'deteksi'; try { t0 = localStorage.getItem('pc_tab') || 'deteksi'; } catch (e) { }
    showTab(['deteksi', 'tuning', 'kunci', 'latih', 'progresi'].includes(t0) ? t0 : 'deteksi');
} catch (e) { console.error(e); if (window.pcShow) window.pcShow('Gagal memuat menu: ' + e.message); }
