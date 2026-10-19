/* Pitchcraft — Pola strum (turun/naik) untuk putaran progresi. */

/* --- Pola strum --- */
const STRUM_PATS = { 'Sekali per birama': ['D', '.', '.', '.', '.', '.', '.', '.'], 'Turun ×4 (↓ ↓ ↓ ↓)': ['D', '.', 'D', '.', 'D', '.', 'D', '.'], 'Pop (↓ ↓↑ ↑↓↑)': ['D', '.', 'D', 'U', '.', 'U', 'D', 'U'], 'Balada (↓↑ terus)': ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'], 'Reggae (↑ off-beat)': ['.', 'U', '.', 'U', '.', 'U', '.', 'U'], 'Waltz 3/4 (↓ ↑ ↑)': ['D', '.', 'U', '.', 'U', '.'], '6/8 (↓ ·· ↓ ·↑)': ['D', '.', '.', 'D', '.', 'U'] };
let strumPatSel = 'Sekali per birama';

function renderPat() { document.getElementById('patView').textContent = STRUM_PATS[strumPatSel].map(x => x === 'D' ? '↓' : x === 'U' ? '↑' : '·').join(' '); }
