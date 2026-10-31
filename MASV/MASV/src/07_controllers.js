// ==========================================================================
// 07_controllers.js
// CONTROLLERS: line-of-sight guidance, heading PID, speed PI, safety shield, manual mode.
// ==========================================================================

// ---------------- agent 4/5: guidance (LOS), PID heading, PI speed, safety shield ----------------
/** Line-of-sight aiming point: the point 'D' metres ahead of the ship's projection on the planned route. */
function carrot(s, R, ri, D) {
    const a = R[ri - 1];
    const b = R[ri];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const L2 = abx * abx + aby * aby || 1;
    const f = Math.min(1, ((s.x - a[0]) * abx + (s.y - a[1]) * aby) / L2);
    let px = a[0] + f * abx;
    let py = a[1] + f * aby;
    const ct = ((s.x - px) * -aby + (s.y - py) * abx) / Math.sqrt(L2);
    let rem = D;
    for (let i = ri; i < R.length; i++) {
        const seg = H(R[i][0] - px, R[i][1] - py);
        if (seg >= rem) {
            const q = rem / seg;
            return [px + (R[i][0] - px) * q, py + (R[i][1] - py) * q, ct];
        }
        rem -= seg;
        px = R[i][0];
        py = R[i][1];
    }
    return [R[R.length - 1][0], R[R.length - 1][1], ct];
}
/**
 * SLIDING-MODE heading controller (robust). Surface sigma = 0.6*e - r (e = heading error, r = yaw rate).
 * Reaching law: dsigma = -1.0*sigma - 0.06*sat(sigma/0.2);  equivalent control (a - lambda)*r / b with
 * b = 0.0123*u^2 (rudder authority), a = 0.4 (yaw damping). The boundary layer (0.2) avoids chattering and an
 * integral term (0.04*int(sigma)) removes steady error under unmodelled disturbances (wind, current moment).
 */
function smc(e, s) {
    const uu = Math.max(Math.abs(s.u), 3);
    const b = .0123 * uu * uu;
    const sig = .6 * e - s.r;
    G.smcI = cl(G.smcI + sig * DT, -1, 1);
    const ueq = (.4 - .6) * s.r / b;
    const ur = (1 * sig + .06 * cl(sig / .2, -1, 1)) / b;
    const ui = .04 * G.smcI;
    G.cd = {
        sig, ueq, ur, ui
    };
    return cl(ueq + ur + ui, -.52, .52);
}
/**
 * NONLINEAR MODEL PREDICTIVE heading controller (runs at 5 Hz). Prediction model = yaw dynamics of the ship
 *   dr = kd*delta - (0.4 r + 3|r|r) + d_hat ,  kd = 0.0123 u^2 ,  d_hat = disturbance observer
 * Horizon 16 x 0.35 s = 5.6 s. Decision = 2 held rudder values (9 x 9 = 81 candidate plans); constraints:
 * |delta| <= 0.52 rad and slew 0.3 rad/s. Cost = sum(e^2 + 1.5 r^2 + 0.15 delta^2) + 6 e_N^2 + 0.3 (d2-d1)^2.
 * The first value of the best plan is applied (receding horizon).
 */
function mpc(e, s) {
    if (G.t - G.mpcT < .2) {
        return G.mpcCmd;
    }
    const dts = G.t - G.mpcT;
    const O = G.mpcO;
    const u = Math.max(s.u, 2);
    const kd = .0123 * u * u;
    const N = 16;
    const h = .35;
    const sw0 = 6;
    const tg = [-.52, -.39, -.26, -.13, 0, .13, .26, .39, .52];
    if (O.pr !== null && dts < .5) {
        O.d = cl(O.d + .35 * ((s.r - O.pr) / dts - (kd * s.rud - (.4 * s.r + 3 * Math.abs(s.r) * s.r)) - O.d), -.15, .15);
    }
    O.pr = s.r;
    G.mpcT = G.t;
    let best = 1e9;
    let b1 = 0;
    let b2 = 0;
    for (const d1 of tg) {
        for (const d2 of tg) {
            let psi = 0;
            let r = s.r;
            let rd = s.rud;
            let J = .3 * (d2 - d1) ** 2;
            for (let k = 0; k < N; k++) {
                rd += cl((k < sw0 ? d1 : d2) - rd, -.3 * h, .3 * h);
                r += h * (kd * rd - (.4 * r + 3 * Math.abs(r) * r) + O.d);
                psi += h * r;
                const ek = e - psi;
                J += ek * ek + 1.5 * r * r + .15 * rd * rd;
            }
            J += 6 * (e - psi) ** 2;
            if (J < best) {
                best = J;
                b1 = d1;
                b2 = d2;
            }
        }
    }
    G.cd = {
        J: best, d1: b1, d2: b2, dh: O.d
    };
    G.mpcCmd = b1;
    return b1;
}
/** Switches the heading controller: 0 PID, 1 sliding mode, 2 MPC (key K). Resets integrators and the metrics scoreboard. */
function setHC(i) {
    HC = i;
    G.ei = 0;
    G.smcI = 0;
    G.mpcT = -9;
    G.mpcO = { pr: null, d: 0 };
    G.m = {
        n: 0, e2: 0, d2: 0, tv: 0, prev: G.ship.rud, c2: 0
    };
    G.cd = null;
    log('Heading controller → ' + HCN[HC], '#c58cff');
}
/**
 * AUTOPILOT (AUTO mode).  Guidance -> shield -> heading PID -> speed PI.
 *  1) LOS guidance:  aim at carrot point, look-ahead D = 35 + 6u;  subtract cross-current crab angle  asin(cn/|V|).
 *  2) Safety shield: potential-field blend  (obstacles/pirates push the desired heading away).
 *  3) Heading PID:   e = psi_cmd - psi ;   delta = sched*(0.9*e - 2.5*r) + 0.02*integral(e)   [|delta| <= 0.52 rad]
 *                    sched = clamp(36/max(u^2,9), 1, 4)  (keeps loop gain constant at low speed)
 *  4) Speed PI:      thr = feedforward(drag at v_d) + 0.35*(v_d - u) + 0.04*integral(v_d - u)
 *     v_d is reduced for big turns / near the goal, and raised to full speed when a pirate is within 450 m.
 */
function control(dt) {
    const s = G.ship;
    const R = G.route;
    while (G.ri < R.length - 1) {
        const a = R[G.ri - 1];
        const b = R[G.ri];
        if (H(s.x - b[0], s.y - b[1]) < 30 || (s.x - b[0]) * (b[0] - a[0]) + (s.y - b[1]) * (b[1] - a[1]) > 0) {
            G.ri++;
        }
        else {
            break;
        }
    }
    const dgl = H(G.goal[0] - s.x, G.goal[1] - s.y);
    if (dgl < 45 && !G.done) {
        G.done = 1;
        G.state = 'ARRIVED';
        log('SAFE HARBOUR REACHED — hostiles break off', '#4dff9a');
        endCard(1);
    }
    if (G.done) {
        return { thr: s.u > .3 ? -.3 : 0, rud: 0 };
    }
    const D = 35 + 6 * Math.max(0, s.u);
    const [cx, cy, ct] = carrot(s, R, G.ri, D);
    G.cte = ct;
    let psid = Math.atan2(cy - s.y, cx - s.x);
    const cu = curAt(s.x, s.y);
    const cn = -cu[0] * S(psid) + cu[1] * C(psid);
    psid -= Math.asin(cl(cn / Math.max(3, H(s.u, s.v)), -.6, .6)); // current crab compensation
    let ax = C(psid); // safety shield: potential-field blend
    let ay = S(psid);
    let al = 0;
    let emg = false;
    let flee = false;
    for (const k of G.tl) {
        const wh = k.kind === 'whirl';
        const p = posAt(k, 0);
        const d = H(s.x - p[0], s.y - p[1]) || 1;
        const c = wh ? d - 1.5 * k.r : d - k.r - SR;
        const inf = k.kind === 'enemy' ? 170 : wh ? 80 : 60;
        if (c < inf) {
            const w = ((inf - c) / inf) ** 2 * (k.kind === 'enemy' ? 3 : 3.5) * (G.relax > 0 ? .3 : 1);
            ax += w * (s.x - p[0]) / d;
            ay += w * (s.y - p[1]) / d;
            al = Math.max(al, 1 - c / inf);
            if (k.kind === 'enemy' && c < 200) {
                flee = true;
            }
            else if (c < (wh ? 0 : 26)) {
                emg = true;
            }
        }
    }
    G.alert = al;
    const pc = Math.atan2(ay, ax);
    G.psid = pc;
    const e = wrap(pc - s.psi);
    const sc = cl(36 / Math.max(s.u * s.u, 9), 1, 4);
    G.ei = cl(G.ei + e * dt, -.5, .5);
    let rud = cl(sc * (.9 * e - 2.5 * s.r) + .02 * G.ei, -.52, .52);
    if (HC === 1) {
        rud = smc(e, s);
    }
    else if (HC === 2) {
        rud = mpc(e, s);
    }
    const ens = G.tl.some(k => k.kind === 'enemy' && H(k.x - s.x, k.y - s.y) < 450);
    let vd = Math.max(4, Math.min(VC, cl(G.vis / 50, 3, 6.5)) * (1 - .3 * Math.min(1, Math.abs(e) / 1.2)));
    if (dgl < 220 && !ens) {
        vd = Math.min(vd, Math.max(2, dgl * .04 + 1));
    }
    {
        let rem = H(s.x - R[G.ri][0], s.y - R[G.ri][1]);
        for (let i = G.ri; i < R.length - 1; i++) {
            rem += H(R[i + 1][0] - R[i][0], R[i + 1][1] - R[i][1]);
        }
        rem = Math.max(rem, dgl) * 1.1;
        const th = v => (.15 * v + .04 * v * v) / 4;
        const need = v => .55 * (th(v) ** 3 + .02) * rem / v * (1 + .15 * WX);
        let cap = VC;
        if (!ens) {
            for (const v of [VC, 5, 4.2, 3.5, 3].filter(q => q >= [3, 3.5, 5][WX])) {
                cap = v;
                if (need(v) <= .8 * G.fuel - 8) {
                    break;
                }
            }
        }
        G.eco = cap < VC;
        vd = Math.min(vd, cap);
    }
    if (emg) {
        vd = Math.max(3.5, vd * .7);
    }
    if (flee || ens) {
        vd = VMAX;
    }
    G.si = cl(G.si + (vd - s.u) * dt, -8, 8);
    const thr = cl((.15 * vd + .04 * vd * vd) / 4 + .35 * (vd - s.u) + .04 * G.si, -.6, 1);
    G.dbg = {
        e, sc, P: .9 * e * sc, Dd: -2.5 * s.r * sc, I: .02 * G.ei, rud, vd, ff: (.15 * vd + .04 * vd * vd) / 4, Ps: .35 * (vd - s.u), Is: .04 * G.si, thr, cn, D, ct, los: psid, cmd: pc, emg, flee
    };
    G.state = G.rrT > 0 ? 'REPLANNING' : flee ? 'EVADING HOSTILE' : emg ? 'EMERGENCY AVOID' : al > .15 ? 'ALERT / AVOID' : 'TRANSIT';
    return { thr, rud };
}
/** MANUAL mode: W/S move the throttle lever, A/D set the rudder directly. Same ship dynamics, no autopilot. */
function manual(dt) {
    if (keys.w) {
        G.mt = Math.min(1, G.mt + 1.2 * dt);
    }
    if (keys.s) {
        G.mt = Math.max(-.5, G.mt - 1.2 * dt);
    }
    G.dbg = null;
    G.state = 'MANUAL';
    return { thr: G.mt, rud: (keys.d ? .52 : 0) - (keys.a ? .52 : 0) };
}
