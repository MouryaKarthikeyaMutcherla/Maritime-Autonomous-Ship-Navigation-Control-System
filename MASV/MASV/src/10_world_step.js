// ==========================================================================
// 10_world_step.js
// WORLD STEP: one 0.05 s tick - hazards, enemies, sensing, planning, control, dynamics, damage.
// ==========================================================================

// ---------------- world step ----------------
function hurt(d, why) {
    const s = G.ship;
    if (s.hp <= 0 || G.done) {
        return;
    }
    s.hp = Math.max(0, s.hp - d);
    G.dmg += d;
    G.hitT = .4;
    log('HIT: ' + why + ' (−' + d.toFixed(0) + '%)', '#ff4d5e');
    if (s.hp <= 0) {
        G.state = 'LOST';
        endCard(0);
    }
}
/** ONE SIMULATION TICK (dt = 0.05 s). Order: hazards/pirates -> escorts -> (5 Hz: comm, scan, predict, assess) -> plan -> control -> RK4 -> damage. */
function step() {
    const dt = DT;
    const s = G.ship;
    const alive = s.hp > 0;
    G.t += dt;
    G.relax = Math.max(0, G.relax - dt);
    G.wind += Math.abs(s.r) * dt;
    if (G.mode === 'AUTO' && !G.done && alive && (G.wt += dt) > 20) {
        const dg = H(G.goal[0] - s.x, G.goal[1] - s.y);
        if (G.wind > 7 && G.wp - dg < 80) {
            log('ORBIT DETECTED — resetting guidance, replanning', '#ffb347');
            G.ei = 0;
            G.si = 0;
            G.lastSw = -9;
            G.pa = 9;
            G.relax = 10;
        }
        G.wt = 0;
        G.wind = 0;
        G.wp = dg;
    }
    if (Math.round(G.t * 2) !== G._tq) {
        G._tq = Math.round(G.t * 2);
        G.trail.push([s.x, s.y]);
        if (G.trail.length > 900) {
            G.trail.shift();
        }
    }
    G.rrT = Math.max(0, G.rrT - dt);
    G.hitT = Math.max(0, G.hitT - dt);
    G.cdT -= dt;
    for (const h of G.hz) {
        if (!h.on && !h.dead && G.t >= h.at) {
            h.on = true;
        }
        if (!h.on) {
            continue;
        }
        if (h.kind === 'enemy') {
            const dx = s.x - h.x;
            const dy = s.y - h.y;
            const d = H(dx, dy);
            if (!h.psi) {
                h.psi = Math.atan2(dy, dx);
            }
            h.psi += cl(wrap(Math.atan2(dy, dx) - h.psi), -.6 * dt, .6 * dt);
            const nb = G.esc.filter(e => e.alive && H(e.x - h.x, e.y - h.y) < 38);
            if (nb.length) {
                h.hp -= Math.min(2, nb.length) * 8 * dt;
                nb.forEach(e => hitE(e, 2.5 * dt, 'engaging hostile'));
                if (h.hp <= 0) {
                    h.on = false;
                    h.dead = true;
                    delete G.tr[h.id];
                    G.tl = G.tl.filter(k => k.id !== h.id);
                    log('HOSTILE NEUTRALISED by escort ' + nb[0].id, '#4dff9a');
                    continue;
                }
            }
            h.u += ((d > 110 ? 5 : cl(s.u, 2, 5)) * (nb.length ? .4 : 1) - h.u) * dt;
            h.vx = C(h.psi) * h.u;
            h.vy = S(h.psi) * h.u;
            h.x += h.vx * dt;
            h.y += h.vy * dt;
            h.cool -= dt;
            if (alive && !G.done && d < 160 && h.cool <= 0) {
                h.cool = 1.2;
                const bl = blocker(h, s);
                G.shots.push({
                    x0: h.x, y0: h.y, x1: bl ? bl.x : s.x, y1: bl ? bl.y : s.y, l: .25
                });
                if (Math.random() < .4) {
                    if (bl) {
                        hitE(bl, 7, 'shielding ship');
                    }
                    else {
                        hurt(4, 'hostile gunfire');
                    }
                }
            }
            for (const o of G.hz) {
                if (o.on && (o.kind === 'island' || o.kind === 'rock')) {
                    const q = H(h.x - o.x, h.y - o.y);
                    const rr = o.r + 20;
                    if (q < rr) {
                        h.x = o.x + (h.x - o.x) / q * rr;
                        h.y = o.y + (h.y - o.y) / q * rr;
                    }
                }
            }
        }
        else {
            h.x += h.vx * dt;
            h.y += h.vy * dt;
        }
        if (h.kind === 'whirl') {
            if (H(s.x - h.x, s.y - h.y) < .3 * h.r) {
                hurt(.08, 'whirlpool crush');
            }
        }
        else if (alive) {
            const d = H(s.x - h.x, s.y - h.y) || 1;
            const rr = h.r * (h.kind === 'island' ? .9 : 1) + SR * .7;
            G.minClr = Math.min(G.minClr, d - h.r - SR);
            if (d < rr) {
                s.x = h.x + (s.x - h.x) / d * rr;
                s.y = h.y + (s.y - h.y) / d * rr;
                if (G.cdT <= 0) {
                    G.cdT = .8;
                    hurt((8 + 4 * Math.abs(s.u)) * (h.kind === 'berg' ? 2.5 : 1), 'collision with ' + h.kind);
                }
                s.u *= .5;
            }
        }
    }
    escorts(dt);
    G.sa += dt;
    if (G.sa >= .2) {
        G.sa = 0;
        comm();
        scan(.2);
        predict();
        assess();
    }
    G.pa += dt;
    if (G.pa > 1.5 || G.newTrack) {
        G.pa = 0;
        G.newTrack = false;
        plan();
    }
    const cmd = !alive ? { thr: 0, rud: 0 } : G.mode === 'AUTO' ? control(dt) : manual(dt);
    if (G.mode === 'MANUAL' && alive && H(G.goal[0] - s.x, G.goal[1] - s.y) < 45 && !G.done) {
        G.done = 1;
        endCard(1);
    }
    updEnv();
    if (G.fuel <= 0) {
        cmd.thr = 0;
    }
    const rl = .52 * (FAULT === 2 ? .5 : 1);
    s.rud += cl(cmd.rud - s.rud, -.3 * dt, .3 * dt);
    s.rud = cl(s.rud, -rl, rl);
    s.thr += (cmd.thr - s.thr) * Math.min(1, dt * 2.5);
    rk4(s, { thr: s.thr, rud: s.rud }, dt);
    if (alive && !G.done && !G.out && (s.x < -150 || s.x > W + 150 || s.y < -150 || s.y > HH + 150)) {
        G.out = true;
        G.state = 'LEFT AREA';
        log('LEFT THE OPERATING AREA', '#ff4d5e');
        endCard(0, 'LEFT OPERATING AREA');
    }
    if (alive && !G.done) {
        const fr = .55 * ((Math.abs(s.thr) * (FAULT === 1 ? .5 : 1)) ** 3 + .02);
        G.fuel = Math.max(0, G.fuel - fr * dt);
        G.fuelUsed += fr * dt;
        if (G.fuel <= 0 && !G.out) {
            G.out = true;
            G.state = 'OUT OF FUEL';
            log('OUT OF FUEL — engine stopped', '#ff4d5e');
            endCard(0, 'OUT OF FUEL');
        }
    }
    const sp = H(s.u, s.v);
    if (sp > .5 && G.fx.length < 600 && alive) {
        for (const sd of [-1, 1]) {
            G.fx.push({
                x: s.x - C(s.psi) * 18 + sd * -S(s.psi) * 4, y: s.y - S(s.psi) * 18 + sd * C(s.psi) * 4, l: 3, m: 3, z: 3 + sp * .3
            });
        }
        if (Math.random() < .5) {
            G.fx.push({
                x: s.x + C(s.psi) * 20 + (Math.random() - .5) * 5, y: s.y + S(s.psi) * 20 + (Math.random() - .5) * 5, l: 1, m: 1, z: 2
            });
        }
    }
    for (const f of G.fx) {
        f.l -= dt;
    }
    G.fx = G.fx.filter(f => f.l > 0);
    for (const q of G.shots) {
        q.l -= dt;
    }
    G.shots = G.shots.filter(q => q.l > 0);
    if (++G.hc % 4 === 0) {
        logRow();
        if (G.mode === 'AUTO' && !G.done && alive && G.dbg) {
            const m = G.m;
            m.n++;
            m.e2 += wrap(G.psid - s.psi) ** 2;
            m.d2 += s.rud ** 2;
            m.tv += Math.abs(s.rud - m.prev);
            m.prev = s.rud;
            m.c2 += G.cte ** 2;
        }
        G.hist.e.push(wrap(G.psid - s.psi));
        G.hist.r.push(s.rud);
        if (G.hist.e.length > 300) {
            G.hist.e.shift();
            G.hist.r.shift();
        }
    }
}
const LOGHDR = 't,x,y,psi,u,v,r,rud,thr,hp,auto,psi_cmd,v_des,cte,risk,cpa,combat,topology,n_strong,n_weak,n_relay,n_none,' + [1, 2, 3, 4, 5, 6].map(i => 'e' + i + '_hp').concat([1, 2, 3, 4, 5, 6].map(i => 'e' + i + '_d'), [1, 2, 3, 4, 5, 6].map(i => 'e' + i + '_x,e' + i + '_y')).join(',') + ',ctrl,wind,hs,fuel,fault';
/** Telemetry logger: one CSV row every 0.2 s (ship states, controller signals, topology, escort status) for MATLAB. */
function logRow() {
    const s = G.ship;
    const d = G.dbg;
    const c = G.comm;
    const r = [G.t.toFixed(2), s.x.toFixed(2), s.y.toFixed(2), s.psi.toFixed(4), s.u.toFixed(3), s.v.toFixed(3), s.r.toFixed(4), s.rud.toFixed(4), s.thr.toFixed(3), s.hp.toFixed(1), G.mode === 'AUTO' ? 1 : 0, G.psid.toFixed(4), d ? d.vd.toFixed(3) : '', G.cte.toFixed(2), G.risk.toFixed(2), Math.min(G.cpa, 999).toFixed(1), G.combat ? 1 : 0, '"' + c.name + '"', c.cnt.s, c.cnt.w, c.cnt.r, c.cnt.n];
    for (const e of G.esc) {
        r.push(e.alive ? e.hp.toFixed(0) : 0);
    }
    for (const e of G.esc) {
        r.push(e.alive ? H(e.x - s.x, e.y - s.y).toFixed(1) : '');
    }
    for (const e of G.esc) {
        r.push(e.x.toFixed(1), e.y.toFixed(1));
    }
    r.push(HC, ENV.V.toFixed(1), WXP[WX].hs, G.fuel.toFixed(1), FAULT);
    G.rows.push(r.join(','));
    if (G.rows.length > 40000) {
        G.rows.shift();
    }
}
function csvLog() {
    return LOGHDR + '\n' + G.rows.join('\n') + '\n';
}
function csvScene() {
    return 'type,x,y,r\nstart,' + MISSIONS[G.mi].s.join(',') + ',0\ngoal,' + G.goal.map(v => v.toFixed(1)).join(',') + ',45\n' + G.hz.map(h => h.kind + ',' + h.x.toFixed(1) + ',' + h.y.toFixed(1) + ',' + h.r).join('\n') + '\n';
}
function dl(n, t) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' }));
    a.download = n;
    document.body.appendChild(a);
    a.click();
    a.remove();
}
/** Downloads masv_log.csv + masv_scene.csv (press O). Plot them with matlab/masv_plot_log.m. */
function exportLog() {
    dl('masv_log.csv', csvLog());
    setTimeout(() => dl('masv_scene.csv', csvScene()), 500);
    log('Exported masv_log.csv + masv_scene.csv (' + G.rows.length + ' samples) for MATLAB', '#4dff9a');
}
/** Wind (gusting), waves (yaw disturbance + added resistance) for the selected weather; read by deriv() as ENV. */
function updEnv() {
    const w = WXP[WX];
    const t = G.t;
    const s = G.ship;
    const V = w.v * (1 + .25 * Math.sin(t * .37) + .15 * Math.sin(t * 1.1 + 1));
    const d = G.wd + .15 * Math.sin(t * .05);
    const a = .0012 * V * V;
    const b = d - s.psi;
    ENV.V = V;
    ENV.d = d;
    ENV.ax = a * Math.cos(b);
    ENV.ay = a * Math.sin(b);
    ENV.nr = .02 * (V / 16) ** 2 * Math.sin(2 * b) + .02 * w.hs * Math.sin(.9 * t) + .012 * w.hs * Math.sin(1.7 * t + 2);
    ENV.dr = 1 + .06 * w.hs;
}
function setWX(i) {
    WX = i;
    G.vis = G.vis0 * WXP[WX].vis;
    log('Weather → ' + WXN[WX] + (WX ? ' · wind ' + WXP[WX].v + ' m/s, waves Hs ' + WXP[WX].hs + ' m, visibility ×' + WXP[WX].vis : ''), '#c58cff');
}
function setFault(i) {
    FAULT = i;
    log(i ? 'FAULT INJECTED: ' + FN[i] : 'Fault cleared', i ? '#ff4d5e' : '#4dff9a');
}
function endCard(ok, msg) {
    const e = document.getElementById('end');
    e.style.display = 'block';
    const sh = G.ship;
    e.innerHTML = `<h2 style="margin:0;color:${ok ? '#4dff9a' : '#ff4d5e'}">${ok ? 'MISSION COMPLETE' : (msg || 'VESSEL LOST')}</h2><p>Time ${G.t.toFixed(0)} s · Hull ${sh.hp.toFixed(0)}% · Replans ${G.replans} · Fuel used ${G.fuelUsed.toFixed(0)}%<br>Closest approach ${Math.max(0, G.minClr).toFixed(0)} m · Damage ${G.dmg.toFixed(0)}% · Escorts lost ${G.escLost}/6</p><p>Press R to retry · 1-5 other missions${ok ? ' · click for a new destination' : ''}</p>`;
}
