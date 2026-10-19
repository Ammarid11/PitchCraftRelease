/* Pitchcraft — Kamus akor: bentuk movable (E/A/D), bentuk open, dan pembangun database akor. */

const FLAT = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };

// E/A/D = bentuk movable dengan root di senar 6/5/4 (angka = offset dari fret root, x = senar mati)
const QUALITIES = [
    { k: "", n: "Major", iv: [0, 4, 7], E: "0 2 2 1 0 0", A: "x 0 2 2 2 0", D: "x x 0 2 3 2" },
    { k: "m", n: "Minor", iv: [0, 3, 7], E: "0 2 2 0 0 0", A: "x 0 2 2 1 0", D: "x x 0 2 3 1" },
    { k: "5", n: "Power Chord (5)", iv: [0, 7], E: "0 2 2 x x x", A: "x 0 2 2 x x", D: "x x 0 2 3 x" },
    { k: "6", n: "Major 6", iv: [0, 4, 7, 9], E: "0 2 2 1 2 0", A: "x 0 2 2 2 2", D: "x x 0 2 0 2" },
    { k: "m6", n: "Minor 6", iv: [0, 3, 7, 9], E: "0 2 2 0 2 0", A: "x 0 2 2 1 2", D: "x x 0 2 0 1" },
    { k: "7", n: "Dominant 7", iv: [0, 4, 7, 10], E: "0 2 0 1 0 0", A: "x 0 2 0 2 0", D: "x x 0 2 1 2" },
    { k: "maj7", n: "Major 7", iv: [0, 4, 7, 11], E: "0 2 1 1 0 0", A: "x 0 2 1 2 0", D: "x x 0 2 2 2" },
    { k: "m7", n: "Minor 7", iv: [0, 3, 7, 10], E: "0 2 0 0 0 0", A: "x 0 2 0 1 0", D: "x x 0 2 1 1" },
    { k: "9", n: "Dominant 9", iv: [0, 4, 7, 10, 2], E: "0 2 0 1 0 2", A: "x 0 -1 0 0 0" },
    { k: "add9", n: "Add 9", iv: [0, 4, 7, 2], E: "0 2 2 1 0 2", A: "x 0 2 4 2 0" },
    { k: "sus2", n: "Suspended 2", iv: [0, 2, 7], E: "0 2 4 4 0 0", A: "x 0 2 2 0 0", D: "x x 0 2 3 0" },
    { k: "sus4", n: "Suspended 4", iv: [0, 5, 7], E: "0 2 2 2 0 0", A: "x 0 2 2 3 0", D: "x x 0 2 3 3" },
    { k: "7sus4", n: "7 Suspended 4", iv: [0, 5, 7, 10], E: "0 2 0 2 0 0", A: "x 0 2 0 3 0" },
    { k: "dim", n: "Diminished", iv: [0, 3, 6], E: "0 1 2 0 x x", A: "x 0 1 2 1 x", D: "x x 0 1 3 1" },
    { k: "dim7", n: "Diminished 7", iv: [0, 3, 6, 9], E: "0 1 2 0 2 0", A: "x 0 1 2 1 2", D: "x x 0 1 0 1" },
    { k: "m7b5", n: "Half-Diminished (m7♭5)", iv: [0, 3, 6, 10], E: "0 1 0 0 x x", A: "x 0 1 0 1 x", D: "x x 0 1 1 1" },
    { k: "aug", n: "Augmented", iv: [0, 4, 8], E: "0 3 2 1 1 0", A: "x 0 3 2 2 1", D: "x x 0 3 3 2" }
];

// Bentuk open tambahan (C, G, F, B7 dst. tidak bisa dibuat dari 3 bentuk di atas)
const OPEN = {
    "C": ["x 3 2 0 1 0"], "C7": ["x 3 2 3 1 0"], "Cmaj7": ["x 3 2 0 0 0"], "Cadd9": ["x 3 2 0 3 0"],
    "Csus2": ["x 3 0 0 1 3"], "Csus4": ["x 3 3 0 1 1"], "C6": ["x 3 2 2 1 0"],
    "G": ["3 2 0 0 0 3", "3 2 0 0 3 3"], "G7": ["3 2 0 0 0 1"], "Gmaj7": ["3 2 0 0 0 2"], "G6": ["3 2 0 0 0 0"],
    "Gadd9": ["3 2 0 2 0 3"], "Gsus2": ["3 0 0 0 3 3"], "Gsus4": ["3 3 0 0 1 3"],
    "F": ["x x 3 2 1 1"], "Fmaj7": ["x x 3 2 1 0"], "Fadd9": ["x x 3 2 1 3"],
    "B7": ["x 2 1 2 0 2"], "A9": ["x 0 2 4 2 3"], "E7": ["0 2 2 1 3 0"], "Em7": ["0 2 2 0 3 0"], "A7": ["x 0 2 2 2 3"]
};
const SHAPE_ROOT = { E: 4, A: 9, D: 2 };
const SHAPE_LABEL = { E: "Bentuk E (root senar 6)", A: "Bentuk A (root senar 5)", D: "Bentuk D (root senar 4)" };

function parseShape(str) { return str.split(" ").map(t => t === "x" ? null : parseInt(t, 10)); }

function buildChordDatabase() {
    const db = {};
    noteStrings.forEach((root, ri) => {
        QUALITIES.forEach(q => {
            const key = root + q.k, seen = new Set(), variants = [];
            const add = (f, desc) => { const id = f.join(","); if (!seen.has(id)) { seen.add(id); variants.push({ fingering: f, desc }); } };
            (OPEN[key] || []).forEach(sh => add(parseShape(sh).map(v => v === null ? -1 : v), "Open Position"));
            ["E", "A", "D"].forEach(t => {
                if (!q[t]) return;
                const r = (ri - SHAPE_ROOT[t] + 12) % 12;
                const f = parseShape(q[t]).map(v => v === null ? -1 : (v + r < 0 ? NaN : v + r));
                if (f.some(isNaN)) return;
                const pos = f.filter(v => v > 0);
                if (pos.length && Math.max(...pos) > 15) return;
                add(f, r === 0 ? "Open Position" : `Barre Fret ${r} — ${SHAPE_LABEL[t]}`);
            });
            const lo = f => { const p = f.filter(v => v > 0); return p.length ? Math.min(...p) : 0; };
            variants.sort((a, b) => lo(a.fingering) - lo(b.fingering));
            db[key] = {
                key, root, variants,
                name: `${root}${FLAT[root] ? "/" + FLAT[root] : ""} ${q.n}`,
                notes: q.iv.map(i => noteStrings[(ri + i) % 12])
            };
        });
    });
    return db;
}

const chordDatabase = buildChordDatabase();
