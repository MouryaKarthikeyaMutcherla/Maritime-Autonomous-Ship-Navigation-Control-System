// ==========================================================================
// 01_missions.js
// Mission definitions: start/goal, current, visibility and the hazards (rock, island, iceberg, whirlpool, pirate ship).
// ==========================================================================

// ---------------- missions ----------------
let hid = 0;
function mk(kind, x, y, r, o = {}) {
    const h = {
        id: ++hid, kind, x, y, r, vx: 0, vy: 0, at: 0, on: true, shape: [], ...o
    };
    h.on = h.at <= 0;
    for (let i = 0; i < 22; i++) {
        h.shape.push(.8 + .28 * rnd());
    }
    if (kind === 'enemy') {
        h.psi = 0;
        h.u = 0;
        h.cool = 0;
        h.hp = 100;
    }
    return h;
}
const MISSIONS = [
    {
        n: '1 · Open Water Transit', s: [100, 500], g: [1500, 500], cur: [0, .4], vis: 420, night: 0, b: () => [mk('island', 760, 440, 95), mk('rock', 420, 600, 22), mk('rock', 1180, 560, 24), mk('island', 1180, 190, 70), mk('rock', 1010, 420, 20)]
    },
    {
        n: '2 · Iceberg Alley (Titanic)', s: [100, 520], g: [1500, 480], cur: [.2, .1], vis: 270, night: 1, b: () => [mk('berg', 520, 470, 46, { vy: .2 }), mk('berg', 800, 570, 55), mk('berg', 950, 390, 38), mk('berg', 1150, 500, 50, { vy: -.25 }), mk('berg', 680, 330, 35), mk('berg', 1000, 640, 45), mk('berg', 350, 560, 30)]
    },
    {
        n: '3 · Pirate Intercept', s: [100, 500], g: [1500, 500], cur: [0, 0], vis: 420, night: 0, b: () => [mk('enemy', 700, 150, 16, { at: 10 }), mk('enemy', 1250, 880, 16, { at: 60 }), mk('rock', 800, 500, 24), mk('island', 1000, 300, 60)]
    },
    {
        n: '4 · Maelstrom', s: [100, 500], g: [1500, 500], cur: [0, .3], vis: 420, night: 0, b: () => [mk('whirl', 600, 500, 120), mk('whirl', 1050, 450, 130), mk('rock', 820, 640, 22)]
    },
    {
        n: '5 · Chaos Archipelago', s: [100, 520], g: [1500, 500], cur: [.3, .2], vis: 400, night: 0, b: () => [mk('island', 500, 350, 80), mk('island', 720, 680, 90), mk('island', 1110, 420, 85), mk('island', 1260, 740, 70), mk('rock', 300, 560, 22), mk('rock', 900, 300, 22), mk('whirl', 900, 560, 90), mk('berg', 1350, 330, 40, { vx: -.2 }), mk('enemy', 900, 120, 16, { at: 25 })]
    },
    {
        n: '6 · The Gauntlet (escort test)', s: [100, 500], g: [1500, 500], cur: [.1, .1], vis: 400, night: 0, b: () => [mk('enemy', 560, 150, 16, { at: 8 }), mk('enemy', 680, 860, 16, { at: 16 }), mk('enemy', 1050, 140, 16, { at: 40 }), mk('rock', 850, 500, 24), mk('island', 1000, 700, 70), mk('whirl', 1250, 380, 90)]
    },
    {
        n: '7 · Long Haul (fuel + storm)', s: [80, 110], g: [1520, 890], cur: [.2, .1], vis: 400, night: 0, fuel: 50, wx: 2, b: () => [mk('island', 520, 380, 80), mk('island', 900, 600, 85), mk('rock', 700, 200, 22), mk('rock', 1200, 780, 24), mk('rock', 300, 700, 22), mk('whirl', 1150, 450, 90), mk('enemy', 800, 880, 16, { at: 60 })]
    }
];
