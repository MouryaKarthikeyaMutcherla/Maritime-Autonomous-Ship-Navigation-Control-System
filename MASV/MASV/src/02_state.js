// ==========================================================================
// 02_state.js
// Simulation state G, escort data, camera, reset() and the event log.
// ==========================================================================

// ---------------- state ----------------
const RHO = [190, 105, 80, 70, 80, 105];
const ROLE = ['SCOUT', 'FLANK-S', 'BEAM-S', 'REAR', 'BEAM-P', 'FLANK-P'];
let escOn = true;
let pm = 0;
let HC = 0;
let WX = 0;
let FAULT = 0;
let wxAuto = false;
const WXN = ['CLEAR', 'BREEZE', 'STORM'];
const FN = ['NONE', 'ENGINE 50%', 'RUDDER 50%', 'RADAR FAIL'];
const WXP = [{
        v: 0, hs: 0, vis: 1
    }, {
        v: 8, hs: 1.2, vis: .85
    }, {
        v: 16, hs: 3, vis: .6
    }];
const ENV = {
    ax: 0, ay: 0, nr: 0, dr: 1, V: 0, d: 0
};
const HCN = ['PID', 'SLIDING MODE', 'MPC'];
function mkEsc() {
    return RHO.map((_, i) => ({
        i, id: 'E' + (i + 1), x: 0, y: 0, vx: 0, vy: 0, psi: 0, hp: 100, alive: true, shield: null, slot: [0, 0], reach: false, hops: 0, p: 1, cd: 0, flash: 0
    }));
}
let G;
let cam = {
    x: 100, y: 500, zz: .9, z: .9, over: 0
};
let speed = 4;
let paused = false;
let acc = 0;
let keys = {};
let M = { x: 0, y: 0 };
let dpr = 1;
function reset(i) {
    hid = 0;
    seed = 7;
    const m = MISSIONS[i];
    if (m.wx !== undefined) {
        WX = m.wx;
        wxAuto = true;
    }
    else if (wxAuto) {
        WX = 0;
        wxAuto = false;
    }
    G = {
        mi: i, t: 0, ship: {
            x: m.s[0], y: m.s[1], psi: 0, u: 4, v: 0, r: 0, rud: 0, thr: .6, hp: 100
        }, hz: m.b(), tr: {}, tl: [], route: [m.s, m.g], ri: 1, cands: [], best: 0, goal: m.g.slice(), cur: m.cur, vis: m.vis * WXP[WX].vis, vis0: m.vis, fuel: m.fuel || 100, fuelUsed: 0, eco: false, wd: 2.4, out: false, night: m.night, mode: 'AUTO', state: 'TRANSIT', log: [], sa: 0, pa: 9, newTrack: false, replans: 0, fx: [], shots: [], hist: { e: [], r: [] }, hitT: 0, cdT: 0, dmg: 0, minClr: 1e9, cpa: 1e9, ttc: 0, thk: null, ei: 0, si: 0, mt: 0, done: 0, rrT: 0, lastSw: -9, esc: mkEsc(), comm: {
            name: '—', base: null, edges: [], nodes: [], cnt: {
                s: 0, w: 0, r: 0, n: 0
            }, partial: false
        }, tt: -9, combat: false, escLost: 0, rows: [], smcI: 0, mpcO: { pr: null, d: 0 }, mpcT: -9, mpcCmd: 0, cd: null, m: {
            n: 0, e2: 0, d2: 0, tv: 0, prev: 0, c2: 0
        }, trail: [], wind: 0, wt: 0, relax: 0, wp: H(m.g[0] - m.s[0], m.g[1] - m.s[1]), d0: H(m.g[0] - m.s[0], m.g[1] - m.s[1]), J: 0, risk: 0, psid: 0, alert: 0, cte: 0, hc: 0
    };
    log('Mission loaded: ' + m.n, '#4fe3ff');
    log('Sensors online: continuous 5 Hz radar/sonar, range ' + m.vis + ' m', '#4fe3ff');
    cam.x = m.s[0];
    cam.y = m.s[1];
    G.esc.forEach(e => {
        const a = e.i * Math.PI / 3;
        e.x = m.s[0] + C(a) * RHO[e.i] * .5;
        e.y = m.s[1] + S(a) * RHO[e.i] * .5;
        e.alive = escOn;
    });
    document.getElementById('end').style.display = 'none';
}
function log(msg, c) {
    G.log.unshift({
        t: G.t, msg, c: c || '#cfeaff'
    });
    if (G.log.length > 9) {
        G.log.pop();
    }
}
