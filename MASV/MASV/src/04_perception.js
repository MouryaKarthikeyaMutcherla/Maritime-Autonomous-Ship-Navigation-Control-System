// ==========================================================================
// 04_perception.js
// AGENT 1 - PERCEPTION: continuous 5 Hz scanning by ship AND escorts, alpha-beta tracker.
// ==========================================================================

// ---------------- agent 1: perception (continuous scan + alpha-beta tracker) ----------------
/**
 * PERCEPTION. Runs at 5 Hz (continuous scanning). Sources = the ship's own sensor + every escort that is
 * CONNECTED through the comm network (detections survive each hop with probability from the link class).
 * Each hazard seen is added/updated as a track with an alpha-beta filter (noise grows with range).
 */
function scan(dt) {
    const s = G.ship;
    const src = [{
            x: s.x, y: s.y, v: G.vis * (FAULT === 3 ? .3 : 1), p: 1
        }];
    for (const e of G.esc) {
        if (e.alive && e.reach) {
            src.push({
                x: e.x, y: e.y, v: G.vis * .9, p: e.p
            });
        }
    }
    for (const h of G.hz) {
        if (!h.on) {
            continue;
        }
        let d = 1e9;
        for (const q of src) {
            const dq = H(h.x - q.x, h.y - q.y);
            if (dq - h.r <= q.v && dq < d && Math.random() <= q.p) {
                d = dq;
            }
        }
        if (d > 1e8) {
            continue;
        }
        const dS = H(h.x - s.x, h.y - s.y);
        const sg = 2 + .012 * d;
        const mx = h.x + gauss() * sg;
        const my = h.y + gauss() * sg;
        const mr = h.r * (1 + .03 * gauss());
        let k = G.tr[h.id];
        if (!k) {
            G.tr[h.id] = k = {
                id: h.id, kind: h.kind, x: mx, y: my, vx: 0, vy: 0, r: mr, seen: G.t
            };
            G.tl.push(k);
            G.newTrack = true;
            log('CONTACT: ' + h.kind.toUpperCase() + ' bearing ' + ((Math.atan2(h.y - s.y, h.x - s.x) * 57.3 + 360) % 360 | 0) + '° range ' + (dS | 0) + ' m', h.kind === 'enemy' ? '#ff4d5e' : '#ffcf5a');
        }
        else {
            const dd = Math.max(G.t - k.seen, .05);
            const px = k.x + k.vx * dd;
            const py = k.y + k.vy * dd;
            const rx = mx - px;
            const ry = my - py;
            const b = h.kind === 'enemy' ? .06 : h.kind === 'berg' ? .015 : 0;
            k.x = px + .5 * rx;
            k.y = py + .5 * ry;
            k.vx += b * rx / dd;
            k.vy += b * ry / dd;
            k.r = .9 * k.r + .1 * mr;
            k.seen = G.t;
        }
    }
}
