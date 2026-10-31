// ==========================================================================
// 03_dynamics.js
// SHIP DYNAMICS - 3-DOF hydrodynamic model + RK4 integrator + current/whirlpool flow field.
// ==========================================================================

// ---------------- hydrodynamics (3-DOF Fossen-type, RK4) ----------------
const MX = 1;
const MY = 1.5;
const IZ = 10;
/** Environmental flow at (x, y): uniform current + tangential/inward whirlpool vortex (Gaussian profile). */
function curAt(x, y) {
    let cx = G.cur[0];
    let cy = G.cur[1];
    for (const h of G.hz) {
        if (h.kind !== 'whirl') {
            continue;
        }
        const rx = x - h.x;
        const ry = y - h.y;
        const d = H(rx, ry) + 1e-6;
        if (d < 2.6 * h.r) {
            const m = 3.5 * Math.exp(-(((d - .8 * h.r) / (.7 * h.r)) ** 2));
            cx += m * (-ry / d) - .35 * m * rx / d;
            cy += m * (rx / d) - .35 * m * ry / d;
        }
    }
    return [cx, cy];
}
/**
 * SHIP DYNAMICS - 3-DOF horizontal-plane model (Fossen-type, normalised units).
 * State a = [x, y, psi, u, v, r]   (position, heading, surge, sway, yaw rate)
 * cmd = { thr: throttle (-0.6..1), rud: rudder angle [rad] },  cu = current [cx, cy]
 *
 *   m_x * du = T - (Xu*u + Xuu*|u|*u) + m_y*v*r
 *   m_y * dv = Y_d - (Yv*v + Yvv*|v|*v) - m_x*u*r
 *   I_z * dr = N_d - (Nr*r + Nrr*|r|*r) + (m_x - m_y)*u*v        (Munk moment)
 *
 *   T   = 4 * throttle              (reverse is 60 % as effective)
 *   Y_d = 0.03 * u|u| * delta       N_d = 0.123 * u|u| * delta   (rudder grows with u^2)
 *   Xu=0.15 Xuu=0.04 | Yv=1.2 Yvv=2 | Nr=4 Nrr=30 | m_x=1 m_y=1.5 I_z=10
 *
 * Kinematics:  dx = u cos(psi) - v sin(psi) + cx ,  dy = u sin(psi) + v cos(psi) + cy
 * Returns [dx, dy, dpsi, du, dv, dr].
 */
function deriv(a, cmd, cu) {
    const [, , p, u, v, r] = a;
    const d = cmd.rud;
    const T = 4 * cmd.thr * (cmd.thr < 0 ? .6 : 1) * (FAULT === 1 ? .5 : 1);
    const du = (T - (.15 * u + .04 * Math.abs(u) * u) * ENV.dr + MY * v * r) / MX + ENV.ax;
    const dv = (.03 * u * Math.abs(u) * d - (1.2 * v + 2 * Math.abs(v) * v) - MX * u * r) / MY + ENV.ay;
    const dr = (.123 * u * Math.abs(u) * d - (4 * r + 30 * Math.abs(r) * r) + (MX - MY) * u * v) / IZ + ENV.nr;
    return [u * C(p) - v * S(p) + cu[0], u * S(p) + v * C(p) + cu[1], r, du, dv, dr];
}
/** 4th-order Runge-Kutta: advances the ship state one step dt using deriv() four times. */
function rk4(s, cmd, dt) {
    const f = a => deriv(a, cmd, curAt(a[0], a[1]));
    const y = [s.x, s.y, s.psi, s.u, s.v, s.r];
    const k1 = f(y);
    const k2 = f(y.map((v, i) => v + .5 * dt * k1[i]));
    const k3 = f(y.map((v, i) => v + .5 * dt * k2[i]));
    const k4 = f(y.map((v, i) => v + dt * k3[i]));
    [s.x, s.y, s.psi, s.u, s.v, s.r] = y.map((v, i) => v + dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
    s.psi = wrap(s.psi);
    s.u = cl(s.u, -2, 9.5);
    s.v = cl(s.v, -3, 3);
    s.r = cl(s.r, -.6, .6);
}
