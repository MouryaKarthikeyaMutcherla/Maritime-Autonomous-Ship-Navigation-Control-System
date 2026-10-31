// ==========================================================================
// 08_escort_fleet.js
// ESCORT FLEET: 6 autonomous surface vehicles - formation, scouting, shielding, harassment.
// ==========================================================================

// ---------------- ESCORT FLEET: 6 autonomous surface vehicles ----------------
function hitE(e, d, why) {
    if (!e.alive) {
        return;
    }
    e.hp -= d;
    e.flash = .3;
    if (e.hp <= 0) {
        e.alive = false;
        G.escLost++;
        log('ESCORT ' + e.id + ' LOST' + (why ? ' (' + why + ')' : '') + ' — fleet re-forming', '#ff4d5e');
    }
}
function setEsc(on) {
    escOn = on;
    for (const e of G.esc) {
        e.alive = on;
        e.hp = 100;
        e.shield = null;
        e.vx = e.vy = 0;
        const a = e.i * Math.PI / 3;
        e.x = G.ship.x + C(a) * RHO[e.i] * .5;
        e.y = G.ship.y + S(a) * RHO[e.i] * .5;
    }
    G.escLost = 0;
    log('Escort fleet ' + (on ? 'ONLINE' : 'OFFLINE'), '#ffb347');
}
/** Returns the escort standing on the segment pirate -> ship (if any): it absorbs the shot meant for the ship. */
function blocker(h, s) {
    let b = null;
    let bt = 2;
    for (const e of G.esc) {
        if (!e.alive) {
            continue;
        }
        const dx = s.x - h.x;
        const dy = s.y - h.y;
        const t = ((e.x - h.x) * dx + (e.y - h.y) * dy) / (dx * dx + dy * dy || 1);
        if (t <= 0 || t >= 1) {
            continue;
        }
        if (H(e.x - (h.x + t * dx), e.y - (h.y + t * dy)) < 22 && t < bt) {
            bt = t;
            b = e;
        }
    }
    return b;
}
/**
 * ESCORT BEHAVIOUR (each step). Slots: E1 scout on the route 190 m ahead, E2/E6 forward flanks, E3/E5 beam guards, E4 rear.
 * Threat assignment: pirates (<450 m) get 2 escorts - one BLOCKS the line of fire, one INTERCEPTS and harasses;
 * rocks/bergs/islands close to the ship get 1 escort on that side. Motion = slot-seeking + hazard/escort repulsion,
 * speed <= 9.5 m/s, acceleration <= 5 m/s^2.
 */
function escorts(dt) {
    const s = G.ship;
    const A = G.esc.filter(e => e.alive);
    if (!A.length) {
        G.combat = false;
        return;
    }
    const [gx, gy] = gvel();
    const R = G.route;
    const cp = carrot(s, R, Math.max(1, Math.min(G.ri, R.length - 1)), 190);
    const hd = Math.atan2(cp[1] - s.y, cp[0] - s.x);
    const T = [];
    for (const k of G.tl) {
        const p = posAt(k, 0);
        const d = H(p[0] - s.x, p[1] - s.y);
        const c = d - k.r;
        if (k.kind === 'enemy') {
            if (d < 450) {
                T.push({
                    a: Math.atan2(p[1] - s.y, p[0] - s.x), u: 3 + 1000 / d, n: 2, Rs: 55, k
                });
            }
        }
        else if (k.kind !== 'whirl' && c < 130 && c > 25) {
            const b = Math.atan2(p[1] - s.y, p[0] - s.x);
            if (Math.abs(wrap(b - hd)) < 1.9) {
                T.push({
                    a: b, u: 1 + 50 / c, n: 1, Rs: cl(c - 30, 35, 55), k
                });
            }
        }
    }
    T.sort((a, b) => b.u - a.u);
    G.combat = T.some(t => t.k.kind === 'enemy');
    for (const e of A) {
        e.shield = null;
        e.cd -= dt;
        e.flash = Math.max(0, e.flash - dt);
        const a = hd + e.i * Math.PI / 3;
        const rho = RHO[e.i] * (G.combat ? .62 : 1);
        e.slot = e.i === 0 && !G.combat ? [cp[0], cp[1]] : [s.x + C(a) * rho, s.y + S(a) * rho];
    }
    const free = A.slice();
    for (const t of T.slice(0, 3)) {
        for (let m = 0; m < t.n && free.length; m++) {
            let bi = 0;
            let bd = 9;
            free.forEach((e, i) => {
                const dd = Math.abs(wrap(Math.atan2(e.y - s.y, e.x - s.x) - t.a));
                if (dd < bd) {
                    bd = dd;
                    bi = i;
                }
            });
            const e = free.splice(bi, 1)[0];
            if (m === 1) {
                const q = posAt(t.k, 3);
                e.slot = [q[0], q[1]];
            }
            else {
                e.slot = [s.x + C(t.a) * t.Rs, s.y + S(t.a) * t.Rs];
            }
            e.shield = t.k;
        }
    }
    for (const e of A) {
        let vx = gx + 1.3 * (e.slot[0] - e.x);
        let vy = gy + 1.3 * (e.slot[1] - e.y);
        for (const h of G.hz) {
            if (!h.on || h.kind === 'enemy') {
                continue;
            }
            const rx = e.x - h.x;
            const ry = e.y - h.y;
            const d = H(rx, ry) || 1;
            const rr = h.kind === 'whirl' ? 1.5 * h.r + 30 : h.r + 26;
            if (d < rr + 50) {
                const w = (rr + 50 - d) / 50 * 9;
                vx += rx / d * w;
                vy += ry / d * w;
            }
        }
        for (const o of A) {
            if (o === e) {
                continue;
            }
            const rx = e.x - o.x;
            const ry = e.y - o.y;
            const d = H(rx, ry) || 1;
            if (d < 28) {
                vx += rx / d * 4;
                vy += ry / d * 4;
            }
        }
        const sp = H(vx, vy);
        if (sp > 9.5) {
            vx *= 9.5 / sp;
            vy *= 9.5 / sp;
        }
        e.vx += cl(vx - e.vx, -5 * dt, 5 * dt);
        e.vy += cl(vy - e.vy, -5 * dt, 5 * dt);
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (H(e.vx, e.vy) > .5) {
            e.psi = Math.atan2(e.vy, e.vx);
        }
        for (const h of G.hz) {
            if (!h.on || h.kind === 'whirl' || h.kind === 'enemy') {
                continue;
            }
            const rx = e.x - h.x;
            const ry = e.y - h.y;
            const d = H(rx, ry) || 1;
            const rr = h.r * (h.kind === 'island' ? .9 : 1) + 7;
            if (d < rr) {
                e.x = h.x + rx / d * rr;
                e.y = h.y + ry / d * rr;
                if (e.cd <= 0) {
                    e.cd = .8;
                    hitE(e, 6, 'hit ' + h.kind);
                }
            }
        }
    }
}
