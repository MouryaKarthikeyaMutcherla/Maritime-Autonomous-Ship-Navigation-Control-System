// ==========================================================================
// 00_core_math.js
// Core constants and tiny math helpers used everywhere (clamp, angle wrap, noise, world size, speeds).
// ==========================================================================

const TAU = Math.PI * 2;
const C = Math.cos;
const S = Math.sin;
const H = Math.hypot;
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => {
    while (a > Math.PI) {
        a -= TAU;
    }
    while (a < -Math.PI) {
        a += TAU;
    }
    return a;
};
let seed = 7;
const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * C(TAU * Math.random());
const W = 1600;
const HH = 1000;
const DT = .05;
const SR = 16;
const VC = 6;
const VMAX = 7.5;
const MG = {
    rock: 38, island: 45, berg: 70, enemy: 150
};
