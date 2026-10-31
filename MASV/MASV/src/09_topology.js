// ==========================================================================
// 09_topology.js
// ADAPTIVE COMMUNICATION TOPOLOGY: dense mesh / mesh / ring / star / chain-relay selection.
// ==========================================================================

// ---------------- adaptive communication topology ----------------
const CL = [[100, 'STRONG', '#4dff9a', 0], [170, 'WEAK', '#ffe14d', .08], [260, 'RELAY', '#ff9a3c', .25]];
const cls = d => CL.find(c => d < c[0]);
/**
 * ADAPTIVE TOPOLOGY. Nodes = ship + living escorts. Link class by distance: <100 STRONG, <170 WEAK, <260 RELAY, else NONE.
 * Choice: hostile engaged -> STAR; fleet radius <110 -> DENSE MESH; <170 -> MESH; <260 -> RING; else CHAIN/RELAY (Prim MST).
 * 3 s minimum dwell; if any node is unreachable it falls back to the MST ('RELAY FALLBACK').
 * BFS from the ship gives hops and delivery probability for each escort (used by scan()).
 */
function comm() {
    const s = G.ship;
    const N = [s, ...G.esc.filter(e => e.alive)];
    const n = N.length;
    const D = N.map(a => N.map(b => H(a.x - b.x, a.y - b.y)));
    const cnt = {
        s: 0, w: 0, r: 0, n: 0
    };
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const c = cls(D[i][j]);
            c ? cnt[c[1][0].toLowerCase()]++ : cnt.n++;
        }
    }
    const all = l => {
        const E = [];
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (D[i][j] < l) {
                    E.push([i, j]);
                }
            }
        }
        return E;
    };
    const mst = () => {
        const E = [];
        const T = Array(n).fill(false);
        T[0] = true;
        for (let c = 1; c < n; c++) {
            let bi = -1;
            let bj = -1;
            let bd = 260;
            for (let i = 0; i < n; i++) {
                if (T[i]) {
                    for (let j = 0; j < n; j++) {
                        if (!T[j] && D[i][j] < bd) {
                            bd = D[i][j];
                            bi = i;
                            bj = j;
                        }
                    }
                }
            }
            if (bi < 0) {
                break;
            }
            E.push([bi, bj]);
            T[bj] = true;
        }
        return E;
    };
    const build = nm => {
        if (nm === 'DENSE MESH') {
            return all(260);
        }
        if (nm === 'MESH') {
            return all(170);
        }
        if (nm === 'CHAIN / RELAY') {
            return mst();
        }
        if (nm === 'STAR (COMBAT)') {
            const E = [];
            for (let j = 1; j < n; j++) {
                if (D[0][j] < 260) {
                    E.push([0, j]);
                }
            }
            return E;
        }
        const E = [];
        const ord = [...Array(Math.max(0, n - 1)).keys()].map(i => i + 1).sort((a, b) => Math.atan2(N[a].y - s.y, N[a].x - s.x) - Math.atan2(N[b].y - s.y, N[b].x - s.x));
        ord.forEach((a, i) => {
            const b = ord[(i + 1) % ord.length];
            if (a !== b && D[a][b] < 260 && !(ord.length === 2 && i)) {
                E.push([a, b]);
            }
        });
        ord.slice().sort((a, b) => D[0][a] - D[0][b]).slice(0, 2).forEach(a => {
            if (D[0][a] < 260) {
                E.push([0, a]);
            }
        });
        return E;
    };
    const bfs = E => {
        const adj = N.map(() => []);
        E.forEach(([a, b]) => {
            adj[a].push(b);
            adj[b].push(a);
        });
        const seen = Array(n).fill(false);
        const par = Array(n).fill(-1);
        const hop = Array(n).fill(0);
        const pr = Array(n).fill(0);
        seen[0] = true;
        pr[0] = 1;
        const q = [0];
        while (q.length) {
            const u = q.shift();
            for (const v of adj[u]) {
                if (!seen[v]) {
                    seen[v] = true;
                    par[v] = u;
                    hop[v] = hop[u] + 1;
                    const c = cls(D[u][v]);
                    pr[v] = pr[u] * (1 - (c ? c[3] : 1));
                    q.push(v);
                }
            }
        }
        return {
            seen, hop, pr
        };
    };
    const S = Math.max(0, ...D[0].slice(1));
    let want = G.combat ? 'STAR (COMBAT)' : S < 110 ? 'DENSE MESH' : S < 170 ? 'MESH' : S < 260 ? 'RING' : 'CHAIN / RELAY';
    const name = (G.t - G.tt < 3 && !G.combat && G.comm.base && G.comm.base !== 'STAR (COMBAT)') ? G.comm.base : want;
    let E = build(name);
    let B = bfs(E);
    let shown = name;
    if (B.seen.some(v => !v) && name !== 'CHAIN / RELAY') {
        const E2 = mst();
        const B2 = bfs(E2);
        if (B2.seen.filter(Boolean).length > B.seen.filter(Boolean).length) {
            E = E2;
            B = B2;
            shown = name + ' → RELAY FALLBACK';
        }
    }
    if (G.comm.base && name !== G.comm.base) {
        G.tt = G.t;
        log('TOPOLOGY: ' + G.comm.base + ' → ' + name + (G.combat ? ' (hostile engaged)' : ''), '#c58cff');
    }
    else if (!G.comm.base) {
        G.tt = G.t;
    }
    N.forEach((e, i) => {
        if (i) {
            e.reach = B.seen[i];
            e.hops = B.hop[i];
            e.p = B.pr[i];
            const c = cls(D[0][i]);
            e.link = !B.seen[i] ? 'NO LINK' : B.hop[i] === 1 && c ? c[1] : 'RELAY·' + B.hop[i] + 'hop';
        }
    });
    G.comm = {
        name: shown, base: name, edges: E, nodes: N, cnt, partial: B.seen.some(v => !v)
    };
}
