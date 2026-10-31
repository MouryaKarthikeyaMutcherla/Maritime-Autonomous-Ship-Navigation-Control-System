// ==========================================================================
// 06_planner.js
// AGENT 3 - PLANNER: risk-aware A*, candidate paths, pursuit-aware scoring, route switching.
// ==========================================================================

// ---------------- agent 3: planner (risk-aware time-dependent A* + candidate scoring) ----------------
let VS = VC;
class PQ {
    constructor() {
        this.a = [];
    }
    get n() {
        return this.a.length;
    }
    push(f, i) {
        const a = this.a;
        a.push([f, i]);
        let c = a.length - 1;
        while (c > 0) {
            const p = (c - 1) >> 1;
            if (a[p][0] <= a[c][0]) {
                break;
            }
            [a[p], a[c]] = [a[c], a[p]];
            c = p;
        }
    }
    pop() {
        const a = this.a;
        const t = a[0];
        const l = a.pop();
        if (a.length) {
            a[0] = l;
            let i = 0;
            for (;;) {
                let m = i;
                const L = 2 * i + 1;
                const R = L + 1;
                if (L < a.length && a[L][0] < a[m][0]) {
                    m = L;
                }
                if (R < a.length && a[R][0] < a[m][0]) {
                    m = R;
                }
                if (m === i) {
                    break;
                }
                [a[m], a[i]] = [a[i], a[m]];
                i = m;
            }
        }
        return t;
    }
}
/** Time-dependent A* on a 25 m grid. Cost = distance * (1 + w * risk); w is the risk-aversion weight. */
function astar(A, B, w) {
    const cs = 25;
    const nx = 64;
    const ny = 40;
    const N = nx * ny;
    const g = new Float32Array(N).fill(1e9);
    const dg = new Float32Array(N);
    const par = new Int32Array(N).fill(-1);
    const cd = new Uint8Array(N);
    const ci = p => cl(p[0] / cs | 0, 0, nx - 1) + cl(p[1] / cs | 0, 0, ny - 1) * nx;
    const si = ci(A);
    const gi = ci(B);
    const pq = new PQ();
    g[si] = 0;
    pq.push(0, si);
    let it = 0;
    while (pq.n && it++ < 9000) {
        const u = pq.pop()[1];
        if (cd[u]) {
            continue;
        }
        cd[u] = 1;
        if (u === gi) {
            break;
        }
        const ux = u % nx;
        const uy = (u / nx) | 0;
        for (let a = -1; a <= 1; a++) {
            for (let b = -1; b <= 1; b++) {
                if (!a && !b) {
                    continue;
                }
                const vx = ux + a;
                const vy = uy + b;
                if (vx < 0 || vy < 0 || vx >= nx || vy >= ny) {
                    continue;
                }
                const v = vx + vy * nx;
                if (cd[v]) {
                    continue;
                }
                const st = (a && b ? 1.414 : 1) * cs;
                const d2 = dg[u] + st;
                const px = (vx + .5) * cs;
                const py = (vy + .5) * cs;
                const rk = risk(px, py, d2 / VS);
                if (rk >= 40 && v !== gi && d2 > 70) {
                    continue;
                }
                const ng = g[u] + st * (1 + w * rk * .5);
                if (ng < g[v]) {
                    g[v] = ng;
                    dg[v] = d2;
                    par[v] = u;
                    pq.push(ng + H(px - B[0], py - B[1]), v);
                }
            }
        }
    }
    if (si !== gi && par[gi] < 0) {
        return null;
    }
    const p = [];
    for (let c = gi; c >= 0 && c !== si; c = par[c]) {
        p.push([(c % nx + .5) * cs, ((c / nx | 0) + .5) * cs]);
    }
    p.push(A);
    p.reverse();
    p[p.length - 1] = B;
    return p;
}
function clear(a, b, th) {
    const L = H(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d <= L; d += 12) {
        const f = d / L;
        if (risk(a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), d / VS) > th) {
            return false;
        }
    }
    return true;
}
function smooth(p, th) {
    const o = [p[0]];
    let i = 0;
    while (i < p.length - 1) {
        let j = p.length - 1;
        while (j > i + 1 && !clear(p[i], p[j], th)) {
            j--;
        }
        o.push(p[j]);
        i = j;
    }
    let q = o;
    for (let k = 0; k < 3; k++) {
        const n = [q[0]];
        for (let m = 0; m < q.length - 1; m++) {
            const a = q[m];
            const b = q[m + 1];
            n.push([.75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1]], [.25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1]]);
        }
        n.push(q[q.length - 1]);
        q = n;
    }
    return q;
}
function pointAt(p, s) {
    for (let i = 0; i < p.length - 1; i++) {
        const d = H(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
        if (s <= d || i === p.length - 2) {
            const f = cl(s / (d || 1), 0, 1);
            return [p[i][0] + f * (p[i + 1][0] - p[i][0]), p[i][1] + f * (p[i + 1][1] - p[i][1])];
        }
        s -= d;
    }
    return p[p.length - 1];
}
function pursue(p) {
    for (const k of G.tl) {
        if (k.kind !== 'enemy' || !k.pred) {
            continue;
        }
        let x = k.pred[0][0];
        let y = k.pred[0][1];
        k.p2 = [[x, y]];
        for (let i = 1; i <= 90; i++) {
            const q = pointAt(p, VS * i);
            const dx = q[0] - x;
            const dy = q[1] - y;
            const d = H(dx, dy) || 1;
            const sp = d > 110 ? 5 : Math.min(5, VS);
            x += dx / d * sp;
            y += dy / d * sp;
            k.p2.push([x, y]);
        }
    }
}
/** Scores a path: J = length + 30 * sum(risk samples every 12 m). Pirates are re-simulated chasing the ship ALONG this path. */
function evalPath(p) {
    pursue(p);
    let L = 0;
    let J = 0;
    let mx = 0;
    for (let m = 0; m < p.length - 1; m++) {
        const a = p[m];
        const b = p[m + 1];
        const d = H(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.ceil(d / 12));
        for (let k = 0; k < n; k++) {
            const f = k / n;
            const rk = risk(a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), (L + f * d) / VS);
            J += 30 * rk;
            mx = Math.max(mx, rk);
        }
        L += d;
    }
    for (const k of G.tl) {
        k.p2 = null;
    }
    return {
        J: J + L, mx, L
    };
}
/**
 * PLANNER. Builds candidate routes (direct line, 4 risk-weighted A* paths, 4 'via' detours when a pirate is near),
 * scores each with evalPath() and switches only when clearly better (4 s hold, 1.5 s when hostile).
 */
function plan() {
    const s = G.ship;
    const A = [s.x, s.y];
    const B = G.goal;
    const cs = [{ n: 'direct', p: [A, B] }];
    const en = G.tl.filter(k => k.kind === 'enemy' && H(k.x - s.x, k.y - s.y) < 600);
    VS = en.length ? 7 : VC;
    for (const [w, th] of [[0, 30], [1.5, 1.2], [4, .5], [10, .15]]) {
        const p = astar(A, B, w);
        if (p) {
            cs.push({ n: 'A* λ=' + w, p: smooth(p, th) });
        }
    }
    if (en.length) {
        const gb = Math.atan2(B[1] - A[1], B[0] - A[0]);
        for (const da of [-1.3, -.7, .7, 1.3]) {
            const a = gb + da;
            const P = [A[0] + C(a) * 260, A[1] + S(a) * 260];
            if (risk(P[0], P[1], 30) >= 40) {
                continue;
            }
            const q = astar(P, B, 3);
            if (q) {
                cs.push({ n: 'via ' + (da * 57 | 0) + '°', p: [A, ...smooth(q, .5)] });
            }
        }
    }
    let bi = 0;
    for (let i = 0; i < cs.length; i++) {
        const e = evalPath(cs[i].p);
        cs[i].J = e.J;
        cs[i].mx = e.mx;
        if (e.J < cs[bi].J) {
            bi = i;
        }
    }
    const old = evalPath([A, ...G.route.slice(G.ri)]);
    const nw = cs[bi];
    G.cands = cs;
    if (G.force || old.mx >= 40 || (G.t - G.lastSw > (en.length ? 1.5 : 4) && (nw.J < old.J * .85 - 15 || G.route.length < 3 && nw.J < old.J - 5))) {
        G.force = 0;
        G.lastSw = G.t;
        if (G.route.length > 2 || old.mx >= 3) {
            G.replans++;
            G.rrT = 2.5;
            log('REPLAN → ' + nw.n + ' · risk ' + old.mx.toFixed(1) + ' → ' + nw.mx.toFixed(1), '#4dff9a');
        }
        G.route = nw.p;
        G.ri = 1;
        G.J = nw.J;
        G.risk = nw.mx;
    }
    else {
        G.J = old.J;
        G.risk = old.mx;
    }
    G.best = G.cands.findIndex(c => c.p === G.route);
}
