// ==========================================================================
// 12_ui_input.js
// UI PANELS, KEYBOARD/MOUSE INPUT and start-up (the last file; it starts the loop).
// ==========================================================================

// ---------------- UI ----------------
const $ = id => document.getElementById(id);
function ui() {
    const s = G.ship;
    const dg = H(G.goal[0] - s.x, G.goal[1] - s.y);
    const sp = H(s.u, s.v);
    const thk = G.thk;
    const col = G.alert > .5 ? '#ff4d5e' : G.alert > .1 ? '#ffb347' : '#4dff9a';
    const dot = (c) => `<span class="d" style="color:${c};background:${c}"></span>`;
    const esA = G.esc.filter(e => e.alive).length;
    const sh = G.esc.filter(e => e.alive && e.shield);
    const mov = G.tl.filter(k => k.kind === 'enemy' || k.kind === 'berg').length;
    const sd = G.state === 'MANUAL' ? '#ffb347' : col;
    $('L').innerHTML = `<h4>VESSEL</h4>MODE <b style="color:${G.mode === 'AUTO' ? '#4dff9a' : '#ffb347'}">${G.mode}</b> · <b style="color:${sd}">${G.state}</b><br>T ${G.t.toFixed(0)}s · Speed ${(sp * 1.944).toFixed(1)} kn · HDG ${((s.psi * 57.3 + 360) % 360).toFixed(0)}°<br>Rudder ${(s.rud * 57.3).toFixed(0)}° · Throttle ${(s.thr * 100).toFixed(0)}% · Yaw ${(s.r * 57.3).toFixed(1)}°/s<br>Hull ${s.hp.toFixed(0)}% · Dist ${dg.toFixed(0)} m · ETA ${sp > .5 ? (dg / sp).toFixed(0) + ' s' : '—'}<br>Cross-track ${Math.abs(G.cte).toFixed(1)} m · Current ${H(...curAt(s.x, s.y)).toFixed(1)} m/s<br>Wind ${ENV.V.toFixed(0)} m/s · Waves Hs ${WXP[WX].hs} m · Fuel ${G.fuel.toFixed(0)}%${G.eco ? ' <b style="color:#ffb347">ECO</b>' : ''}${FAULT ? '<br><b style="color:#ff4d5e">FAULT: ' + FN[FAULT] + '</b>' : ''}
 <h4>AUTONOMY AGENTS</h4>
 <div class="ag">${dot('#4dff9a')}<div><b>PERCEPTION</b> 5 Hz continuous scan<br>${G.tl.length} tracks · range ${G.vis} m · α-β filter</div></div>
 <div class="ag">${dot(G.cpa < 60 ? '#ffb347' : '#4dff9a')}<div><b>PREDICTION</b> ${mov} moving · pursuit model<br>${thk ? 'CPA ' + Math.max(0, G.cpa).toFixed(0) + ' m (' + thk.kind + ') in ' + G.ttc + ' s' : 'no contacts'}</div></div>
 <div class="ag">${dot(G.risk >= 3 ? '#ff4d5e' : G.risk > .5 ? '#ffb347' : '#4dff9a')}<div><b>PLANNER</b> ${G.cands.length} candidate paths<br>risk-A* · best: ${(G.cands[G.best] || { n: '—' }).n} · risk ${G.risk.toFixed(1)} · replans ${G.replans}</div></div>
 <div class="ag">${dot('#4dff9a')}<div><b>CONTROL</b> LOS → ${HCN[HC]} rudder · PI speed<br>ψ err ${(wrap(G.psid - s.psi) * 57.3).toFixed(0)}° · current crab-comp</div></div>
 <div class="ag">${dot(col)}<div><b>SAFETY SHIELD</b> ${G.alert > .5 ? 'EVADE' : G.alert > .1 ? 'ALERT' : 'CLEAR'}<br>potential-field override</div></div>
 <div class="ag">${dot(esA < 6 ? '#ffb347' : '#4dff9a')}<div><b>ESCORT FLEET</b> ${esA}/6 alive · ${G.combat ? 'COMBAT' : 'TRANSIT'} formation<br>${G.comm.name}${sh.length ? ' · shielding: ' + sh.map(e => e.id).join(',') : ''}</div></div>`;
    {
        const c = G.comm;
        const col = { STRONG: '#4dff9a', WEAK: '#ffe14d' };
        const cc = l => col[l] || (l === 'NO LINK' ? '#ff4d5e' : '#ff9a3c');
        let t = `<b style="color:#4fe3ff">ADAPTIVE COMMUNICATION</b>\nTOPOLOGY <b style="color:#fff">${c.name}</b> · ${(G.t - G.tt).toFixed(0)}s\n<b style="color:${c.partial ? '#ff9a3c' : '#4dff9a'}">${c.partial ? 'PARTIALLY DISCONNECTED' : 'FULLY CONNECTED'}</b>\nRANGE  0-100 STRONG · 100-170 WEAK\n       170-260 RELAY · >260 NO LINK\nLINKS (all pairs) Strong ${c.cnt.s} · Weak ${c.cnt.w} · Relay ${c.cnt.r} · None ${c.cnt.n}\n<span style="color:#8fd8ff">SHIP ⇄ ESCORTS</span>\n`;
        for (const e of G.esc) {
            t += e.alive ? `${e.id} <span style="color:#cfeaff">${(e.shield ? 'SHLD-' + e.shield.kind.slice(0, 4).toUpperCase() : ROLE[e.i]).padEnd(10)}</span><span style="color:${cc(e.link)}">${(e.link || '—').padEnd(9)}</span> HP${(e.hp | 0)}%\n` : `${e.id} <span style="color:#ff4d5e">${escOn ? 'DESTROYED' : 'OFFLINE'}</span>\n`;
        }
        $('cm').innerHTML = t + '<span style="color:#8fd8ff">Green solid=STRONG · Yellow dash=WEAK · Orange dots=RELAY</span>';
    }
    $('lg').innerHTML = '<h4>EVENT LOG</h4>' + G.log.map(l => `<div style="color:${l.c}">[${l.t.toFixed(0).padStart(3)}s] ${l.msg}</div>`).join('');
    {
        const f = (x, d = 2) => x == null ? '—' : x.toFixed(d);
        const u = s.u;
        const v = s.v;
        const r = s.r;
        const q = deriv([s.x, s.y, s.psi, u, v, r], { thr: s.thr, rud: s.rud }, curAt(s.x, s.y));
        const T = 4 * s.thr * (s.thr < 0 ? .6 : 1);
        const d = G.dbg;
        const dg2 = 57.296;
        const cd = G.cd || {};
        const mm = G.m;
        const met = 'Controller: ' + HCN[HC] + (mm.n > 10 ? ' · RMS ψ-err ' + f(Math.sqrt(mm.e2 / mm.n) * dg2, 1) + '° · rudder travel ' + f(mm.tv * dg2 / (mm.n * .2) * 60, 0) + '°/min · RMS xte ' + f(Math.sqrt(mm.c2 / mm.n), 1) + ' m' : ' · collecting metrics…');
        const hcText = HC === 0 ? `Heading PID: e ${f(d ? d.e * dg2 : 0, 1)}° ×sched ${f(d ? d.sc : 0, 1)}\n  δ = ${f(d ? d.P : 0)}(P) ${f(d ? d.Dd : 0)}(D) ${f(d ? d.I : 0)}(I) = ${f(d ? d.rud * dg2 : 0, 1)}°` : HC === 1 ? `Sliding mode: σ=0.6e−r=${f(cd.sig)}\n  δ = ${f(cd.ueq)}(eq) ${f(cd.ur)}(reach) ${f(cd.ui)}(int) = ${f(d ? d.rud * dg2 : 0, 1)}°` : `MPC N=16 Δt=0.35s: J=${f(cd.J, 2)} dist-est ${f(cd.dh, 3)}\n  plan δ1=${f((cd.d1 || 0) * dg2, 0)}° δ2=${f((cd.d2 || 0) * dg2, 0)}° → ${f(d ? d.rud * dg2 : 0, 1)}°`;
        $('dc').textContent = `PLANT · 3-DOF surface ship (Fossen), RK4 @20 Hz
M·ν̇ = τ_prop + τ_rudder − D(ν)ν − C(ν)ν + τ_current
u̇ = (T − Xu·u − Xuu|u|u + m_y·v·r)/m_x
  T ${f(T)} − drag ${f(.15 * u + .04 * Math.abs(u) * u)} + cpl ${f(MY * v * r)} → u̇ ${f(q[3])}
v̇ = (Yδ − Yv·v − Yvv|v|v − m_x·u·r)/m_y
  Yδ ${f(.03 * u * Math.abs(u) * s.rud)} − drag ${f(1.2 * v + 2 * Math.abs(v) * v)} − ${f(MX * u * r)} → v̇ ${f(q[4])}
ṙ = (Nδ − Nr·r − Nrr|r|r + (m_x−m_y)uv)/Iz
  Nδ ${f(.123 * u * Math.abs(u) * s.rud)} − drag ${f(4 * r + 30 * Math.abs(r) * r)} + Munk ${f((MX - MY) * u * v)} → ṙ ${f(q[5])}
State u ${f(u)} v ${f(v)} r ${f(r * dg2, 1)}°/s ψ ${f(s.psi * dg2, 0)}°
` + (G.mode === 'AUTO' && d ? `CONTROLLERS (auto)
LOS guidance: Δ=35+6u=${f(35 + 6 * Math.max(0, u), 0)} m · xte ${f(d.ct, 1)} m
  ψ_LOS ${f(d.los * dg2, 0)}° (crab −${f(Math.asin(cl(d.cn / Math.max(3, H(u, v)), -.6, .6)) * dg2, 1)}°) → shield ψ_cmd ${f(d.cmd * dg2, 0)}°
${hcText}
Speed PI: v_d ${f(d.vd)} m/s${d.flee ? ' (FLEE)' : d.emg ? ' (BRAKE)' : ''}
  thr = ${f(d.ff)}(ff) ${f(d.Ps)}(P) ${f(d.Is)}(I) = ${f(d.thr)}
Shield: ${G.alert > .5 ? 'EVADE' : G.alert > .1 ? 'ALERT' : 'CLEAR'} · planner risk ${f(G.risk, 1)}
${met}` : `CONTROLLER (manual): operator → δ ${f(s.rud * dg2, 0)}° , throttle ${f(G.mt * 100, 0)}%
Same plant, no autopilot. W/S throttle, A/D rudder.`);
    }
    {
        const ens = G.tl.filter(k => k.kind === 'enemy').map(k => ({ k, d: H(k.x - s.x, k.y - s.y) })).sort((a, b) => a.d - b.d)[0];
        const pr = Math.round(cl(1 - dg / Math.max(G.d0, 1), 0, 1) * 100);
        const bar = '▰'.repeat(pr / 10 | 0) + '▱'.repeat(10 - (pr / 10 | 0));
        let tx;
        if (G.state === 'LOST') {
            tx = '✖ Vessel lost — press R to retry';
        }
        else if (G.done) {
            tx = '✔ Arrived at destination';
        }
        else if (G.mode === 'MANUAL') {
            tx = G.mt < .05 ? 'MANUAL · hold W (or ▲) to add throttle, then A / D to steer toward ⚑' : 'MANUAL · you are steering · throttle ' + ((G.mt * 100) | 0) + '% · ' + (dg | 0) + ' m to ⚑';
        }
        else if (sh.length && ens && ens.d < 450) {
            tx = 'Escorts ' + sh.map(e => e.id).join(', ') + ' shielding the ship from the hostile · topology ' + G.comm.name;
        }
        else if (ens && ens.d < 260) {
            tx = 'Hostile ship ' + (ens.d | 0) + ' m away — evading at full speed, then rerouting';
        }
        else if (G.rrT > 0) {
            tx = 'Danger detected ahead — planner chose a new safe route';
        }
        else if (G.alert > .1 && thk) {
            tx = 'Passing close to a ' + thk.kind + ' — steering clear';
        }
        else if (thk && G.cpa < 120 && thk.kind !== 'whirl') {
            tx = 'Tracking ' + thk.kind + '; closest approach ' + (Math.max(0, G.cpa) | 0) + ' m — planner checking alternatives';
        }
        else {
            tx = 'Scanning — route clear. Sailing to ⚑, ' + (dg | 0) + ' m to go';
        }
        $('nar').textContent = (FAULT ? 'FAULT ' + FN[FAULT] + ' · ' : '') + (G.eco ? 'ECO SPEED · ' : '') + (G.fuel < 15 ? 'LOW FUEL · ' : '') + tx + '   START ' + bar + ' GOAL ' + pr + '%';
        $('pad').style.display = G.mode === 'MANUAL' ? 'grid' : 'none';
    }
    const b = $('bn');
    let m = '';
    let c = '#ffb347';
    if (G.state === 'LOST' || G.done) {
        m = '';
    }
    else if (G.tl.some(k => k.kind === 'enemy' && H(k.x - s.x, k.y - s.y) < 260)) {
        m = '⚠ HOSTILE CONTACT — ' + (G.mode === 'AUTO' ? 'EVADING' : 'TAKE ACTION');
        c = '#ff4d5e';
    }
    else if (G.rrT > 0) {
        m = '↻ NEW SAFE ROUTE SELECTED';
        c = '#4dff9a';
    }
    else if (thk && G.cpa < 35 && G.ttc < 30 && sp > 1 && thk.kind !== 'whirl') {
        m = '⚠ COLLISION RISK: ' + thk.kind.toUpperCase() + ' in ' + G.ttc + ' s';
        c = '#ff4d5e';
    }
    b.style.display = m ? 'block' : 'none';
    b.textContent = m;
    b.style.color = c;
    b.style.borderColor = c;
    $('bm').textContent = G.mode + ' MODE';
    $('bx').textContent = 'Escorts: ' + (escOn ? 'ON' : 'OFF');
    $('bc').textContent = 'Heading: ' + HCN[HC];
    $('bw').textContent = 'Weather: ' + WXN[WX];
    $('bf').textContent = 'Fault: ' + FN[FAULT];
    $('bm').className = G.mode === 'MANUAL' ? 'man' : '';
}
function setMode(m) {
    G.mode = m;
    G.ei = 0;
    G.si = 0;
    G.mt = G.ship.thr;
    log('Control mode: ' + m, '#ffb347');
}
function pick(i) {
    reset(i);
    $('ms').value = i;
}
$('ms').innerHTML = MISSIONS.map((m, i) => `<option value="${i}">${m.n}</option>`).join('');
$('ms').onchange = e => reset(+e.target.value);
$('bm').onclick = () => setMode(G.mode === 'AUTO' ? 'MANUAL' : 'AUTO');
$('bp').onclick = () => {
    paused = !paused;
    $('bp').textContent = paused ? 'Resume' : 'Pause';
};
const applyPm = () => {
    $('cm').style.display = pm === 0 ? 'block' : 'none';
    $('dc').style.display = pm === 1 ? 'block' : 'none';
};
$('bd').onclick = () => {
    pm = (pm + 1) % 3;
    applyPm();
};
$('bx').onclick = () => setEsc(!escOn);
$('bo').onclick = exportLog;
$('bc').onclick = () => setHC((HC + 1) % 3);
$('bw').onclick = () => setWX((WX + 1) % 3);
$('bf').onclick = () => setFault((FAULT + 1) % 4);
$('bs').onclick = () => {
    speed = speed >= 8 ? 1 : speed * 2;
    $('bs').textContent = speed + 'x';
};
$('bv').onclick = () => {
    cam.over = !cam.over;
    $('bv').textContent = cam.over ? 'Follow' : 'Overview';
};
$('br').onclick = () => reset(G.mi);
const km = {
    arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd'
};
addEventListener('keydown', e => {
    let k = e.key.toLowerCase();
    k = km[k] || k;
    keys[k] = 1;
    if (k.startsWith('arrow') || k === ' ') {
        e.preventDefault();
    }
    if (k === 'm') {
        $('bm').click();
    }
    else if (k === 'p') {
        $('bp').click();
    }
    else if (k === 'f') {
        $('bv').click();
    }
    else if (k === 't') {
        $('bd').click();
    }
    else if (k === 'e') {
        $('bx').click();
    }
    else if (k === 'o') {
        $('bo').click();
    }
    else if (k === 'k') {
        $('bc').click();
    }
    else if (k === 'g') {
        $('bw').click();
    }
    else if (k === 'j') {
        $('bf').click();
    }
    else if (k === 'r' || k === 'enter') {
        reset(G.mi);
    }
    else if ('1234567'.includes(k) && k.length === 1) {
        pick(+k - 1);
    }
    else if ('zxcv'.includes(k) && k.length === 1) {
        const sp = {
            z: () => mk('enemy', M.x, M.y, 16, { at: 0 }), x: () => mk('berg', M.x, M.y, 45, { vx: .2 }), c: () => mk('whirl', M.x, M.y, 100), v: () => mk('rock', M.x, M.y, 22)
        }[k]();
        G.hz.push(sp);
        log('Operator injected ' + sp.kind.toUpperCase() + ' into the scenario', '#ffb347');
    }
});
addEventListener('keyup', e => {
    let k = e.key.toLowerCase();
    keys[km[k] || k] = 0;
});
const w2 = (e) => {
    M.x = (e.clientX * dpr - cv.width / 2) / cam.zz + cam.x;
    M.y = (e.clientY * dpr - cv.height / 2) / cam.zz + cam.y;
};
cv.addEventListener('mousemove', w2);
/** Sets a new destination. Rejects land/hazard spots, then DISCARDS the old route (force re-plan) so the ship never circles the old goal. */
function setGoal(gx = M.x, gy = M.y) {
    if (gx < 30 || gx > W - 30 || gy < 30 || gy > HH - 30 || G.hz.some(h => h.on && h.kind !== 'enemy' && H(gx - h.x, gy - h.y) < (h.kind === 'whirl' ? 1.5 * h.r : h.r) + 70)) {
        log('Destination rejected — land, hazard or out of bounds', '#ff4d5e');
        return false;
    }
    const s = G.ship;
    G.goal = [gx, gy];
    G.done = 0;
    G.d0 = H(gx - s.x, gy - s.y);
    G.wp = G.d0;
    G.wind = 0;
    G.wt = 0;
    G.route = [[s.x, s.y], [gx, gy]];
    G.ri = 1;
    G.cands = [];
    G.best = -1;
    G.lastSw = -9;
    G.force = 1;
    G.ei = 0;
    G.si = 0;
    G.pa = 9;
    G.state = 'TRANSIT';
    $('end').style.display = 'none';
    log('New destination set', '#4dff9a');
    return true;
}
let lc = 0;
cv.addEventListener('click', e => {
    w2(e);
    const n = performance.now();
    if (n - lc < 450) {
        setGoal();
    }
    lc = n;
});
document.querySelectorAll('#pad button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => {
        e.preventDefault();
        keys[k] = 1;
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => {
        keys[k] = 0;
    }));
});
$('bl').onclick = () => {
    const d = $('L').style.display === 'none' ? 'block' : 'none';
    $('L').style.display = $('lg').style.display = d;
};
if (innerWidth < 900) {
    $('L').style.display = $('lg').style.display = 'none';
    pm = 2;
}
applyPm();
cv.addEventListener('wheel', e => {
    e.preventDefault();
    cam.z = cl(cam.z * (e.deltaY < 0 ? 1.1 : .9), .35, 2.2);
}, { passive: false });
addEventListener('resize', resize);
let last = 0;
let errs = 0;
addEventListener('error', e => {
    const b = $('bn');
    b.style.display = 'block';
    b.style.color = '#ff4d5e';
    b.textContent = 'Error: ' + e.message;
});
function loop(ts) {
    requestAnimationFrame(loop);
    try {
        const fd = Math.min(.1, (ts - last) / 1000 || 0);
        last = ts;
        if (!paused) {
            acc += fd * speed;
            let n = 0;
            while (acc >= DT && n++ < 60) {
                step();
                acc -= DT;
            }
        }
        render();
    }
    catch (e) {
        if (errs++ < 3) {
            console.error(e);
        }
    }
}
resize();
$('bs').textContent = speed + 'x';
pat = mkPat();
reset(0);
$('ms').value = 0;
setInterval(ui, 160);
requestAnimationFrame(loop);
window.SIM = {
    setWX, setFault, setHC, setGoal, csvLog, csvScene, setEsc, render, ui, get keys() {
        return keys;
    }, reset, step, get G() {
        return G;
    }, MISSIONS, setMode, plan
};
