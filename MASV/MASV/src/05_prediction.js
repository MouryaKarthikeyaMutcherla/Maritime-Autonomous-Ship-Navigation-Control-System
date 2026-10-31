// ==========================================================================
// 05_prediction.js
// AGENT 2 - PREDICTION: motion prediction, closest-point-of-approach, and the risk field.
// ==========================================================================

// ---------------- agent 2: prediction ----------------
function gvel() {
    const s = G.ship;
    const c = curAt(s.x, s.y);
    return [s.u * C(s.psi) - s.v * S(s.psi) + c[0], s.u * S(s.psi) + s.v * C(s.psi) + c[1]];
}
/** PREDICTION. 90 s look-ahead for moving tracks: icebergs drift; pirates are predicted as PURSUING the ship. */
function predict() {
    const s = G.ship;
    const [gx, gy] = gvel();
    for (const k of G.tl) {
        if (k.kind !== 'enemy' && k.kind !== 'berg') {
            continue;
        }
        const st = Math.min(G.t - k.seen, 20);
        let x = k.x + k.vx * st;
        let y = k.y + k.vy * st;
        k.pred = [[x, y]];
        for (let i = 1; i <= 90; i++) {
            if (k.kind === 'berg') {
                x += k.vx;
                y += k.vy;
            }
            else {
                const dx = s.x + gx * i - x;
                const dy = s.y + gy * i - y;
                const d = H(dx, dy) || 1;
                const sp = d > 110 ? 5 : cl(H(gx, gy), 2, 5);
                x += dx / d * sp;
                y += dy / d * sp;
            }
            k.pred.push([x, y]);
        }
    }
}
const posAt = (k, t) => {
    const a = k.p2 || k.pred;
    return a ? a[Math.min(90, Math.max(0, t | 0))] : [k.x, k.y];
};
/** Closest point of approach (CPA) and time-to-closest-approach of the ship's straight-line projection vs every track. */
function assess() {
    const [gx, gy] = gvel();
    let best = 1e9;
    let bt = 0;
    let bk = null;
    for (const k of G.tl) {
        for (let t = 0; t <= 60; t += 2) {
            const p = posAt(k, t);
            const c = H(G.ship.x + gx * t - p[0], G.ship.y + gy * t - p[1]) - k.r - (k.kind === 'whirl' ? 0 : SR);
            if (c < best) {
                best = c;
                bt = t;
                bk = k;
            }
        }
    }
    G.cpa = best;
    G.ttc = bt;
    G.thk = bk;
}
/**
 * RISK FIELD r(x, y, t): the planner's cost map. Hazard margins (soft, quadratic), hard cores (50),
 * pirate weapon range (150 m), whirlpool keep-out ring (1.5 x radius). t selects the predicted hazard position.
 */
function risk(x, y, t) {
    let R = 0;
    for (const k of G.tl) {
        const p = posAt(k, t);
        const d = H(x - p[0], y - p[1]);
        if (k.kind === 'whirl') {
            const ko = 1.5 * k.r;
            if (d < ko) {
                R += 50;
            }
            else if (d < ko + 90) {
                R += ((ko + 90 - d) / 90) ** 2 * 5;
            }
            continue;
        }
        const c = d - k.r - SR;
        const m = MG[k.kind] * (FAULT === 2 && k.kind !== 'enemy' ? 1.5 : 1);
        if (c < -6) {
            R += 50;
        }
        else if (c < m) {
            R += ((m - c) / m) ** 2 * (k.kind === 'enemy' ? 8 : 7);
        }
    }
    if (x < 50 || x > W - 50 || y < 50 || y > HH - 50) {
        R += 6;
    }
    return R;
}
