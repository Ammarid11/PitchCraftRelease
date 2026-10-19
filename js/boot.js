/* Pitchcraft — Penangkap error awal (ES5 murni agar tetap jalan di browser lama; menampilkan banner penyebab jika skrip utama gagal). */

/* ES5 murni: tetap jalan di browser lama & menampilkan penyebab jika skrip utama gagal */
(function () {
    function show(m) { var b = document.getElementById('pcBanner'); if (b) { b.style.display = 'block'; b.textContent = m; } }
    window.pcShow = show;
    window.onerror = function (msg, src, line) { show('Terjadi error di browser ini: ' + msg + (line ? ' (baris ' + line + ')' : '') + '. Coba perbarui browser, atau buka di Chrome / Firefox.'); };
    try { new Function('async function f(){}; const a=()=>1; return `x`;'); }
    catch (e) { show('Browser ini terlalu lama untuk aplikasi ini (tidak mendukung JavaScript modern). Perbarui browser atau buka di Chrome / Firefox terbaru.'); }
    if (location.protocol === 'file:') { setTimeout(function () { var b = document.getElementById('pcBanner'); if (b && b.style.display === 'none' && !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) show('Halaman dibuka dari file lokal; mikrofon mungkin diblokir. Buka lewat https:// untuk memakai tuner.'); }, 500); }
})();
