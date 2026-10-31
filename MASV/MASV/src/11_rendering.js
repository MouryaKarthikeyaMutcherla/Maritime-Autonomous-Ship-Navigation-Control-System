// ==========================================================================
// 11_rendering.js
// RENDERING: canvas drawing of water, hazards, ships, links, HUD (no simulation logic).
// ==========================================================================

// ---------------- rendering ----------------
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let pat;
function mkPat() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    for (let i = 0; i < 70; i++) {
        x.strokeStyle = `rgba(190,235,255,${.04 + .08 * Math.random()})`;
        x.lineWidth = 1 + Math.random() * 1.5;
        const px = Math.random() * 256;
        const py = Math.random() * 256;
        const l = 10 + Math.random() * 34;
        for (const dx of [-256, 0, 256]) {
            for (const dy of [-256, 0, 256]) {
                x.beginPath();
                x.moveTo(px + dx, py + dy);
                x.quadraticCurveTo(px + dx + l / 2, py + dy - 4, px + dx + l, py + dy);
                x.stroke();
            }
        }
    }
    return ctx.createPattern(c, 'repeat');
}
function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
}
function blob(h, s) {
    ctx.beginPath();
    const n = h.shape.length;
    for (let i = 0; i <= n; i++) {
        const a = i / n * TAU;
        const m = h.shape[i % n] * s * h.r;
        i ? ctx.lineTo(h.x + C(a) * m, h.y + S(a) * m) : ctx.moveTo(h.x + C(a) * m, h.y + S(a) * m);
    }
    ctx.closePath();
}
function fillB(h, s, c) {
    blob(h, s);
    ctx.fillStyle = c;
    ctx.fill();
}
function drawShip(x, y, psi, col, sc, rud) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(psi);
    ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.quadraticCurveTo(14, -7.5, 4, -7.5);
    ctx.lineTo(-18, -7);
    ctx.quadraticCurveTo(-21, 0, -18, 7);
    ctx.lineTo(4, 7.5);
    ctx.quadraticCurveTo(14, 7.5, 22, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -8, 0, 8);
    g.addColorStop(0, col[0]);
    g.addColorStop(1, col[1]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(-14, -5, 26, 10);
    ctx.fillStyle = '#e9f3fa';
    ctx.fillRect(-6, -4.5, 10, 9);
    ctx.fillStyle = '#294a63';
    ctx.fillRect(1, -3.5, 2.5, 7);
    ctx.fillStyle = col[2];
    ctx.fillRect(-12, -2.5, 5, 5);
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(-2, -6.5, 1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4dff9a';
    ctx.beginPath();
    ctx.arc(-2, 6.5, 1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffd27a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-19, 0);
    ctx.lineTo(-19 - 5 * C(rud || 0), 5 * S(rud || 0));
    ctx.stroke();
    ctx.restore();
}
function render() {
    const cw = cv.width;
    const ch = cv.height;
    const U = dpr;
    const s = G.ship;
    const t = G.t;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#010912';
    ctx.fillRect(0, 0, cw, ch);
    const tz = cam.over ? Math.min(cw / (W + 100), ch / (HH + 100)) : cam.z * U;
    cam.x += ((cam.over ? W / 2 : s.x) - cam.x) * .1;
    cam.y += ((cam.over ? HH / 2 : s.y) - cam.y) * .1;
    cam.zz += (tz - cam.zz) * .1;
    const z = cam.zz;
    ctx.setTransform(z, 0, 0, z, cw / 2 - cam.x * z, ch / 2 - cam.y * z);
    const x0 = cam.x - cw / 2 / z;
    const y0 = cam.y - ch / 2 / z;
    const vw = cw / z;
    const vh = ch / z;
    const wg = ctx.createLinearGradient(0, 0, W, HH);
    wg.addColorStop(0, '#0c5f86');
    wg.addColorStop(.5, '#0a4a72');
    wg.addColorStop(1, '#073656');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, HH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, HH);
    ctx.clip();
    for (const [sc, vx, vy, al] of [[1, 5, 2, 1], [1.7, -3, 4, .6]]) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, al * (1 + .4 * WX));
        ctx.scale(sc, sc);
        ctx.translate(t * vx, t * vy);
        ctx.fillStyle = pat;
        ctx.fillRect((x0) / sc - t * vx, (y0) / sc - t * vy, vw / sc, vh / sc);
        ctx.restore();
    }
    ctx.strokeStyle = 'rgba(140,210,255,.07)';
    ctx.lineWidth = 1 / z;
    ctx.beginPath();
    for (let i = 0; i <= W; i += 200) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, HH);
    }
    for (let i = 0; i <= HH; i += 200) {
        ctx.moveTo(0, i);
        ctx.lineTo(W, i);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,77,94,.6)';
    ctx.lineWidth = 3 / z;
    ctx.setLineDash([14 / z, 10 / z]);
    ctx.strokeRect(0, 0, W, HH);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(180,240,255,.5)';
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    G.trail.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
    ctx.stroke();
    for (let bx = Math.max(0, Math.floor(x0 / 100) * 100); bx <= Math.min(W, x0 + vw); bx += 100) {
        for (let by = Math.max(0, Math.floor(y0 / 100) * 100); by <= Math.min(HH, y0 + vh); by += 100) {
            ctx.fillStyle = 'rgba(255,170,60,.85)';
            ctx.beginPath();
            ctx.arc(bx, by + 2 * S(t * 2 + bx + by), 3.5, 0, TAU);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.9)';
            ctx.beginPath();
            ctx.arc(bx, by + 2 * S(t * 2 + bx + by), 1.5, 0, TAU);
            ctx.fill();
        }
    }
    // hazards
    for (const h of G.hz) {
        if (!h.on) {
            continue;
        }
        ctx.globalAlpha = G.night && !G.tr[h.id] ? .4 : 1;
        ctx.lineJoin = 'round';
        if (h.kind === 'island') {
            fillB(h, 1.4, 'rgba(90,225,210,.2)');
            fillB(h, 1.15, 'rgba(120,235,205,.35)');
            fillB(h, 1, '#e3cf9a');
            fillB(h, .86, '#3f8f4f');
            fillB(h, .55, '#2f6f3f');
            ctx.fillStyle = '#245a33';
            for (let i = 0; i < 9; i++) {
                const a = i * 2.4;
                const m = h.r * .45 * ((i * 37 % 10) / 10 + .2);
                ctx.beginPath();
                ctx.arc(h.x + C(a) * m, h.y + S(a) * m, h.r * .07, 0, TAU);
                ctx.fill();
            }
        }
        else if (h.kind === 'rock') {
            fillB(h, 1.5, 'rgba(255,255,255,' + (.12 + .06 * S(t * 2 + h.id)) + ')');
            fillB(h, 1, '#4a4f57');
            fillB(h, .6, '#6b727c');
        }
        else if (h.kind === 'berg') {
            fillB(h, 1.35, 'rgba(160,235,255,.2)');
            blob(h, 1);
            const g = ctx.createRadialGradient(h.x - h.r * .3, h.y - h.r * .3, 2, h.x, h.y, h.r);
            g.addColorStop(0, '#fff');
            g.addColorStop(1, '#a9d8f0');
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = '#e8fbff';
            ctx.lineWidth = 1.5 / z;
            ctx.stroke();
            fillB(h, .5, 'rgba(255,255,255,.55)');
        }
        else if (h.kind === 'whirl') {
            ctx.save();
            ctx.translate(h.x, h.y);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, h.r * 1.5);
            g.addColorStop(0, 'rgba(1,10,24,.95)');
            g.addColorStop(.5, 'rgba(5,40,70,.55)');
            g.addColorStop(1, 'rgba(5,40,70,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, h.r * 1.5, 0, TAU);
            ctx.fill();
            ctx.rotate(t * 1.4);
            ctx.strokeStyle = 'rgba(210,240,255,.4)';
            ctx.lineWidth = 2 / z;
            for (let a = 0; a < 5; a++) {
                ctx.beginPath();
                for (let i = 0; i <= 40; i++) {
                    const q = i / 40;
                    const r = h.r * (.1 + 1.35 * q);
                    const an = a * TAU / 5 - q * 5;
                    i ? ctx.lineTo(C(an) * r, S(an) * r) : ctx.moveTo(C(an) * r, S(an) * r);
                }
                ctx.stroke();
            }
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }
    // goal
    const gp = G.goal;
    ctx.strokeStyle = '#4dff9a';
    ctx.lineWidth = 2 / z;
    for (let i = 0; i < 2; i++) {
        ctx.globalAlpha = 1 - ((t * .6 + i * .5) % 1);
        ctx.beginPath();
        ctx.arc(gp[0], gp[1], 20 + ((t * .6 + i * .5) % 1) * 45, 0, TAU);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#4dff9a';
    ctx.font = `bold ${13 / z}px monospace`;
    ctx.fillText('⚑ DESTINATION', gp[0] - 48, gp[1] - 30);
    // candidate paths + chosen route
    const line = (p, from) => {
        ctx.beginPath();
        p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
    };
    G.cands.forEach((c, i) => {
        if (i === G.best) {
            return;
        }
        ctx.strokeStyle = c.mx >= 40 ? 'rgba(255,77,94,.45)' : c.mx > 1.5 ? 'rgba(255,179,71,.4)' : 'rgba(79,227,255,.3)';
        ctx.lineWidth = 1.5 / z;
        ctx.setLineDash([4 / z, 6 / z]);
        line(c.p);
        ctx.stroke();
    });
    const rr = [[s.x, s.y], ...G.route.slice(G.ri)];
    ctx.setLineDash([12 / z, 8 / z]);
    ctx.lineDashOffset = -t * 30 / z;
    ctx.strokeStyle = 'rgba(79,255,200,.25)';
    ctx.lineWidth = 8 / z;
    line(rr);
    ctx.stroke();
    ctx.strokeStyle = '#7dffd9';
    ctx.lineWidth = 2.5 / z;
    line(rr);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    // track overlays & predictions
    for (const k of G.tl) {
        const col = k.kind === 'enemy' ? '#ff4d5e' : k.kind === 'whirl' ? '#c58cff' : '#ffcf5a';
        const p = posAt(k, 0);
        const mg = MG[k.kind] || 0;
        const rad = k.kind === 'whirl' ? 1.5 * k.r : k.r + SR + mg;
        ctx.strokeStyle = col;
        ctx.globalAlpha = .55;
        ctx.lineWidth = 1.5 / z;
        ctx.setLineDash([6 / z, 6 / z]);
        ctx.beginPath();
        ctx.arc(p[0], p[1], rad, 0, TAU);
        ctx.stroke();
        if (k.kind === 'whirl') {
            ctx.fillStyle = 'rgba(197,140,255,.1)';
            ctx.fill();
        }
        ctx.setLineDash([]);
        if (k.pred) {
            ctx.beginPath();
            for (let i = 0; i <= 60; i += 3) {
                const q = k.pred[i];
                i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
            }
            ctx.setLineDash([2 / z, 5 / z]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.globalAlpha = 1;
        const b = k.r + 10;
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            ctx.moveTo(p[0] + a * b, p[1] + c * b * .6);
            ctx.lineTo(p[0] + a * b, p[1] + c * b);
            ctx.lineTo(p[0] + a * b * .6, p[1] + c * b);
        }
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.font = `${11 / z}px monospace`;
        ctx.fillText(k.kind.toUpperCase() + ' ' + (H(p[0] - s.x, p[1] - s.y) | 0) + 'm', p[0] + b + 4, p[1] - b);
    }
    // wake
    for (const f of G.fx) {
        const a = f.l / f.m;
        ctx.fillStyle = `rgba(235,250,255,${.5 * a})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.z * (1.4 - a * .4), 0, TAU);
        ctx.fill();
    }
    // radar sweep + range ring
    ctx.strokeStyle = 'rgba(79,227,255,.25)';
    ctx.setLineDash([3 / z, 9 / z]);
    ctx.lineWidth = 1.5 / z;
    ctx.beginPath();
    ctx.arc(s.x, s.y, G.vis, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 14; i++) {
        ctx.fillStyle = `rgba(79,227,255,${.07 * (1 - i / 14)})`;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.arc(s.x, s.y, G.vis, t * 2.5 - i * .05, t * 2.5 - i * .05 + .06);
        ctx.fill();
    }
    // fleet links + escorts
    for (const [i, j] of G.comm.edges) {
        const a = G.comm.nodes[i];
        const b = G.comm.nodes[j];
        if (!a || !b || a.alive === false || b.alive === false) {
            continue;
        }
        const c = cls(H(a.x - b.x, a.y - b.y));
        if (!c) {
            continue;
        }
        ctx.strokeStyle = c[2];
        ctx.lineWidth = (c[1] === 'STRONG' ? 3 : 2) / z;
        ctx.setLineDash(c[1] === 'STRONG' ? [] : c[1] === 'WEAK' ? [10 / z, 6 / z] : [2 / z, 5 / z]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const e of G.esc) {
        if (!e.alive) {
            continue;
        }
        ctx.strokeStyle = 'rgba(255,255,255,.3)';
        ctx.lineWidth = 1 / z;
        ctx.beginPath();
        ctx.moveTo(e.slot[0] - 5, e.slot[1]);
        ctx.lineTo(e.slot[0] + 5, e.slot[1]);
        ctx.moveTo(e.slot[0], e.slot[1] - 5);
        ctx.lineTo(e.slot[0], e.slot[1] + 5);
        ctx.stroke();
        if (e.i === 0) {
            ctx.strokeStyle = 'rgba(120,230,255,.18)';
            ctx.setLineDash([3 / z, 8 / z]);
            ctx.beginPath();
            ctx.arc(e.x, e.y, G.vis * .9, 0, TAU);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        drawShip(e.x, e.y, e.psi, ['#9bf0ff', '#2a7fa0', '#ffd24a'], .62, 0);
        if (e.shield) {
            ctx.strokeStyle = '#ffb347';
            ctx.lineWidth = 2 / z;
            ctx.beginPath();
            ctx.arc(e.x, e.y, 17, 0, TAU);
            ctx.stroke();
        }
        if (e.flash > 0) {
            ctx.fillStyle = 'rgba(255,60,60,.5)';
            ctx.beginPath();
            ctx.arc(e.x, e.y, 15, 0, TAU);
            ctx.fill();
        }
        ctx.fillStyle = '#bff6ff';
        ctx.font = `bold ${10 / z}px monospace`;
        ctx.fillText(e.id, e.x - 8, e.y - 20);
        ctx.fillStyle = '#123';
        ctx.fillRect(e.x - 12, e.y + 15, 24, 3 / z + 1);
        ctx.fillStyle = e.hp > 50 ? '#4dff9a' : e.hp > 25 ? '#ffb347' : '#ff4d5e';
        ctx.fillRect(e.x - 12, e.y + 15, 24 * Math.max(0, e.hp) / 100, 3 / z + 1);
    }
    // ships
    for (const h of G.hz) {
        if (h.on && h.kind === 'enemy') {
            ctx.strokeStyle = 'rgba(255,77,94,.35)';
            ctx.lineWidth = 1.5 / z;
            ctx.beginPath();
            ctx.arc(h.x, h.y, 160, 0, TAU);
            ctx.stroke();
            drawShip(h.x, h.y, h.psi, ['#a32a35', '#4d1219', '#222'], 1.1, 0);
            ctx.fillStyle = '#300';
            ctx.fillRect(h.x - 16, h.y + 18, 32, 4);
            ctx.fillStyle = '#ff6a6a';
            ctx.fillRect(h.x - 16, h.y + 18, 32 * Math.max(0, h.hp) / 100, 4);
        }
    }
    for (const q of G.shots) {
        ctx.strokeStyle = 'rgba(255,220,120,' + q.l * 4 + ')';
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.moveTo(q.x0, q.y0);
        ctx.lineTo(q.x1, q.y1);
        ctx.stroke();
    }
    if (s.hp > 0) {
        drawShip(s.x, s.y, s.psi, ['#dfe9f2', '#7e97ad', '#2c6fa8'], 1.25, s.rud);
    }
    else {
        ctx.globalAlpha = .6;
        drawShip(s.x, s.y, s.psi, ['#555', '#222', '#111'], 1.25, 0);
        ctx.globalAlpha = 1;
    }
    // ---- screen space ----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (G.night) {
        const sx = cw / 2 + (s.x - cam.x) * z;
        const sy = ch / 2 + (s.y - cam.y) * z;
        const g = ctx.createRadialGradient(sx, sy, 60 * z, sx, sy, 420 * z);
        g.addColorStop(0, 'rgba(0,6,22,.15)');
        g.addColorStop(1, 'rgba(0,4,16,.7)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, cw, ch);
    }
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * .4, cw / 2, ch / 2, Math.max(cw, ch) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,5,12,.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cw, ch);
    if (G.hitT > 0) {
        ctx.fillStyle = `rgba(255,30,50,${G.hitT * .5})`;
        ctx.fillRect(0, 0, cw, ch);
    }
    // weather overlay
    if (WX) {
        ctx.fillStyle = `rgba(8,20,32,${.12 * WX})`;
        ctx.fillRect(0, 0, cw, ch);
        ctx.strokeStyle = 'rgba(200,225,245,.35)';
        ctx.lineWidth = U;
        ctx.beginPath();
        const nrain = WX * 70;
        const rc = Math.cos(ENV.d);
        for (let i = 0; i < nrain; i++) {
            const rx = ((i * 137.5 + G.t * 80 * rc * WX) % cw + cw) % cw;
            const ry = ((i * 71.7 + G.t * 420) % ch + ch) % ch;
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + 7 * U * rc, ry + 14 * U);
        }
        ctx.stroke();
    }
    // dest arrow
    {
        const gx = cw / 2 + (gp[0] - cam.x) * z;
        const gy = ch / 2 + (gp[1] - cam.y) * z;
        const m = 40 * U;
        if (gx < m || gx > cw - m || gy < m || gy > ch - m) {
            const a = Math.atan2(gy - ch / 2, gx - cw / 2);
            const ex = cl(gx, m, cw - m);
            const ey = cl(gy, m + 90 * U, ch - m);
            ctx.save();
            ctx.translate(ex, ey);
            ctx.rotate(a);
            ctx.fillStyle = '#4dff9a';
            ctx.beginPath();
            ctx.moveTo(16 * U, 0);
            ctx.lineTo(-10 * U, -11 * U);
            ctx.lineTo(-10 * U, 11 * U);
            ctx.fill();
            ctx.restore();
            ctx.font = `${12 * U}px monospace`;
            ctx.fillText('DEST ' + (H(gp[0] - s.x, gp[1] - s.y) | 0) + ' m', cl(ex - 30 * U, 6 * U, cw - 110 * U), ey + (ey < ch / 2 ? 26 * U : -18 * U));
        }
    }
    // minimap
    const nw = innerWidth < 900;
    const mw = (nw ? 130 : 230) * U;
    const mh = mw * HH / W;
    const mx = cw - mw - 12 * U;
    const my = ch - mh - 12 * U;
    const k = mw / W;
    ctx.fillStyle = 'rgba(4,24,42,.85)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = 'rgba(79,227,255,.5)';
    ctx.strokeRect(mx, my, mw, mh);
    for (const h of G.hz) {
        if (!h.on) {
            continue;
        }
        ctx.fillStyle = h.kind === 'enemy' ? '#ff4d5e' : h.kind === 'whirl' ? '#c58cff' : h.kind === 'berg' ? '#cfeaff' : h.kind === 'island' ? '#6fbf7a' : '#999';
        ctx.globalAlpha = G.tr[h.id] ? 1 : .45;
        ctx.beginPath();
        ctx.arc(mx + h.x * k, my + h.y * k, Math.max(2 * U, h.r * k), 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#7dffd9';
    ctx.beginPath();
    ctx.moveTo(mx + s.x * k, my + s.y * k);
    for (let i = G.ri; i < G.route.length; i++) {
        ctx.lineTo(mx + G.route[i][0] * k, my + G.route[i][1] * k);
    }
    ctx.stroke();
    ctx.fillStyle = '#4dff9a';
    ctx.fillRect(mx + gp[0] * k - 3 * U, my + gp[1] * k - 3 * U, 6 * U, 6 * U);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx + s.x * k, my + s.y * k, 3.5 * U, 0, TAU);
    ctx.fill();
    if (WX) {
        const ax = mx + 24 * U;
        const ay = my + 24 * U;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.fillStyle = 'rgba(4,24,42,.9)';
        ctx.beginPath();
        ctx.arc(0, 0, 20 * U, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#8fd8ff';
        ctx.stroke();
        ctx.rotate(ENV.d);
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath();
        ctx.moveTo(14 * U, 0);
        ctx.lineTo(-8 * U, -7 * U);
        ctx.lineTo(-8 * U, 7 * U);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#cfeaff';
        ctx.font = `${10 * U}px monospace`;
        ctx.fillText(ENV.V.toFixed(0) + ' m/s', ax - 16 * U, ay + 34 * U);
    }
    // strip chart (heading error / rudder)
    const cx0 = 12 * U;
    const cw2 = (nw ? 0 : 260) * U;
    const ch2 = (nw ? 0 : 84) * U;
    const cy0 = ch - ch2 - 12 * U;
    ctx.fillStyle = 'rgba(4,24,42,.85)';
    ctx.fillRect(cx0, cy0, cw2, ch2);
    ctx.strokeStyle = 'rgba(79,227,255,.5)';
    ctx.strokeRect(cx0, cy0, cw2, ch2);
    ctx.font = `${10 * U}px monospace`;
    ctx.fillStyle = '#4fe3ff';
    if (!nw) {
        ctx.fillText('HEADING ERR (cyan) · RUDDER (orange)', cx0 + 6 * U, cy0 + 12 * U);
    }
    for (const [arr, sc, c] of (nw ? [] : [[G.hist.e, 1 / Math.PI, '#4fe3ff'], [G.hist.r, 1 / .52, '#ffb347']])) {
        ctx.strokeStyle = c;
        ctx.beginPath();
        arr.forEach((v, i) => {
            const px = cx0 + i / 300 * cw2;
            const py = cy0 + ch2 / 2 + 14 * U - cl(v * sc, -1, 1) * (ch2 / 2 - 18 * U);
            i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.stroke();
    }
}
