/* Pitchcraft — Menu tab di bagian bawah layar. */

function showTab(n) {
    document.querySelectorAll('[data-tab]').forEach(e => e.classList.toggle('on', e.dataset.tab === n));
    document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.go === n));
    window.scrollTo(0, 0); window.curTab = n;
    try { localStorage.setItem('pc_tab', n); } catch (e) { }
}

document.querySelectorAll('#tabbar button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.go)));
