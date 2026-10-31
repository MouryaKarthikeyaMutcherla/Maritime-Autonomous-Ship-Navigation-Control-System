# MASV – Ship Autonomy Engine (readable edition)

Open `index.html` in Chrome/Edge (double-click, no server needed). Behaviour is identical to the published web app;
only the code layout changed (formatted, split by topic, documented).

## File map (load order = reading order)

| File | What it contains |
|---|---|
| `src/00_core_math.js` | constants, clamp/angle-wrap helpers, world size, speeds |
| `src/01_missions.js` | 6 missions: start/goal, current, visibility, hazards |
| `src/02_state.js` | simulation state `G`, camera, `reset()`, event log |
| **`src/03_dynamics.js`** | **ship hydrodynamics: `deriv()` (3-DOF equations), `rk4()`, `curAt()` (current + whirlpool)** |
| `src/04_perception.js` | Agent 1: 5 Hz scanning, alpha-beta tracker (ship + escort sensors) |
| `src/05_prediction.js` | Agent 2: motion prediction, CPA, `risk()` field |
| `src/06_planner.js` | Agent 3: risk-aware A*, candidate paths, pursuit-aware scoring |
| **`src/07_controllers.js`** | **LOS guidance, heading PID, speed PI, safety shield (`control()`), manual mode** |
| `src/08_escort_fleet.js` | 6 escort vehicles: formation, scouting, shielding, harassment |
| **`src/09_topology.js`** | **adaptive communication topology `comm()`** |
| `src/10_world_step.js` | `step()`: one 0.05 s tick that wires everything together |
| `src/11_rendering.js` | canvas drawing only (no simulation logic) |
| `src/12_ui_input.js` | panels (incl. live equations panel), keyboard/mouse, start-up |
| `matlab/masv_dynamics_tests.m` | MATLAB: turning circle, zig-zag, speed PI, heading PID, LOS + current, whirlpool field, topology rules |
| `matlab/masv_plot_log.m` | MATLAB: plots the telemetry exported from the running simulator |

In VS Code: **Ctrl+P** opens a file by name, **Ctrl+Shift+O** lists every function in the open file,
**Ctrl+G** jumps to a line. Every key function has a comment block above it explaining the maths.

## Ship dynamics (03_dynamics.js)

State: position (x, y), heading psi, surge u, sway v, yaw rate r. Inputs: throttle, rudder angle delta.

    m_x du = T - (Xu u + Xuu |u| u) + m_y v r
    m_y dv = Y_d - (Yv v + Yvv |v| v) - m_x u r
    I_z dr = N_d - (Nr r + Nrr |r| r) + (m_x - m_y) u v        (Munk moment)
    dx = u cos(psi) - v sin(psi) + cx        dy = u sin(psi) + v cos(psi) + cy

| Parameter | Value |
|---|---|
| m_x, m_y, I_z | 1, 1.5, 10 (normalised) |
| Xu, Xuu | 0.15, 0.04 |
| Yv, Yvv | 1.2, 2 |
| Nr, Nrr | 4, 30 |
| Thrust T | 4 x throttle |
| Rudder force / moment | Y_d = 0.03 u\|u\| delta ; N_d = 0.123 u\|u\| delta |
| Rudder limit / slew | 0.52 rad (30 deg) / 0.3 rad/s |

Integrated with 4th-order Runge-Kutta at dt = 0.05 s. Currents and whirlpools enter as the flow field `curAt()`.

## Controllers (07_controllers.js, `control()`)

1. **LOS guidance** – aim at a point D = 35 + 6u metres ahead on the route; subtract the cross-current crab angle asin(cn/|V|).
2. **Safety shield** – potential-field blend: obstacles and pirates push the desired heading away.
3. **Heading PID** – e = psi_cmd - psi ; delta = sched (0.9 e - 2.5 r) + 0.02 integral(e), sched = clamp(36/max(u^2, 9), 1, 4).
4. **Speed PI** – thr = drag feed-forward(v_d) + 0.35 (v_d - u) + 0.04 integral(v_d - u).

## Advanced heading controllers (07_controllers.js) - switch live with the *Heading* button or key **K**

| | PID (baseline) | Sliding mode (`smc()`) | Nonlinear MPC (`mpc()`) |
|---|---|---|---|
| Idea | P + yaw-rate damping + I | drive sigma = 0.6 e - r to 0 | optimise the rudder over a 5.6 s horizon |
| Model used | none | yaw dynamics: dr = b*delta - a*r | yaw dynamics with nonlinear damping + disturbance observer |
| Constraints | clipped afterwards | clipped afterwards | inside the optimisation: rudder 30 deg, slew 17 deg/s |
| Disturbance handling | integral term | switching term + integral | observer d_hat (yaw-acceleration bias) |
| Sample rate | 20 Hz | 20 Hz | 5 Hz (81 candidate plans x 16 steps) |

Sliding mode: reaching law dsigma = -1.0 sigma - 0.06 sat(sigma/0.2), equivalent control (a - lambda) r / b with
b = 0.0123 u^2 and a = 0.4; the boundary layer avoids chattering.
MPC: cost = sum(e^2 + 1.5 r^2 + 0.15 delta^2) + 6 e_N^2 + 0.3 (d2 - d1)^2 over 16 steps of 0.35 s; the first value of the best
plan is applied (receding horizon). The speed controller and the LOS guidance are unchanged for all three.

A live **scoreboard** in the equations panel (press T) shows RMS heading error, rudder travel (actuator wear) and RMS cross-track
error for the controller in use; the counters reset whenever you switch.

## Real-life features (new)

| Feature | Where | What it does |
|---|---|---|
| Weather (key **G**: CLEAR / BREEZE / STORM) | `updEnv()` in `10_world_step.js`, `deriv()` in `03_dynamics.js` | gusting wind force on the hull, wave-induced yaw disturbance (two sinusoids), added resistance (1 + 0.06 Hs), lower visibility (x0.85 / x0.6), rain, wind arrow |
| Fuel and energy agent | `step()` and `control()` | fuel rate = 0.55 (throttle^3 + 0.02) %/s; the autopilot estimates fuel needed for the remaining route and chooses an **eco speed** (6, 5, 4.2, 3.5, 3 m/s) so it can arrive with a reserve; empty tank stops the engine |
| Minimum steerage speed | `control()` | the eco speed never drops below 3 / 3.5 / 5 m/s (clear / breeze / storm): below that the rudder cannot overpower wind and waves |
| Fault injection (key **J**) | `step()`, `scan()`, `risk()` | ENGINE 50 % (thrust halved), RUDDER 50 % (limit 15 deg; planner widens margins), RADAR FAIL (own radar range x0.3; escort sensors keep working) |
| Operating area | `step()` | leaving the map by more than 150 m ends the mission |
| Mission 7 "Long Haul (fuel + storm)" | `01_missions.js` | 1650 m trip in a storm with a 50 % tank and a pirate |

Measured (headless runs): in a storm the sliding-mode / MPC controllers keep RMS heading error at 8.7 / 9.5 deg versus 12.5 deg for PID
(Open Water). Radar failure in Chaos Archipelago: only 1-3 of 8 arrive without escorts (two sessions), 8 / 8 with them. Long Haul: 8 / 8 arrive with 4-10 % fuel left.
The CSV export now also logs `wind, hs, fuel, fault`; `masv_plot_log` draws a weather / fuel / fault figure, and
`masv_dynamics_tests` figures 9-10 show the fuel law, the weather model and the steerage-speed limit.

## Communication topologies (09_topology.js, `comm()`)

Link class by distance: < 100 STRONG, < 170 WEAK, < 260 RELAY, else NO LINK.

| Situation | Topology |
|---|---|
| hostile engaged | STAR (ship is the hub) |
| fleet radius < 110 | DENSE MESH |
| < 170 | MESH |
| < 260 | RING |
| larger | CHAIN / RELAY (minimum spanning tree) |

3 s minimum dwell; if a node would be unreachable the network falls back to the relay chain.
A breadth-first search from the ship gives hop counts and delivery probability, which decide whether an escort's detections reach the ship.

## Suggested demo for the professor

1. Mission 1, AUTO: press **T** until the *PLANT* panel shows live u, v, r and the PID / PI terms. Point at the heading-error / rudder chart.
2. Press **M** for MANUAL: the same dynamics driven by W/S/A/D with no autopilot.
3. Mission 4 (Maelstrom): the purple keep-out ring around whirlpools.
3b. Press **K** to cycle PID -> sliding mode -> MPC on any mission and compare the scoreboard (T panel).
4. Mission 6 (Gauntlet): press **E** to turn escorts off (the ship is lost), then on (it arrives undamaged).
5. Press **T** to show the *ADAPTIVE COMMUNICATION* panel switching topology when a hostile appears.

Known limits: escorts use a simplified velocity-command model (the ship alone uses the full hydrodynamic model);
Iceberg Alley and Pirate Intercept can still lose the ship in rare cases.

## MATLAB link (graphs)

Base MATLAB only (R2016b or newer); no toolboxes.

**A. Plots from the running simulator (real data).**
1. Run any mission in `index.html`, then press **O** (or click *Export CSV*). Two files download:
   `masv_log.csv` (46 columns every 0.2 s: states, rudder, throttle, desired heading/speed, cross-track, risk, CPA,
   topology name, link counts, escort HP / distance / position) and `masv_scene.csv` (start, goal, hazards).
2. In MATLAB: `cd` to the `matlab` folder and run `masv_plot_log`. It picks up the newest `masv_log*.csv` from the
   current folder or `Downloads`. Figures: trajectory with hazards and escorts, controller performance
   (heading vs command, error, rudder, yaw rate, speed, throttle), guidance/risk/hull, topology timeline + link counts + escort status.

**B. Controller / dynamics verification (no simulator needed).** Run `masv_dynamics_tests`. It re-implements the same
equations and gains and draws 7 figures: turning circle, 10/10 zig-zag, speed-PI step, heading-PID step (with and without
gain scheduling), LOS guidance under cross-current (with and without crab compensation), whirlpool flow field with the
keep-out ring, the topology/link-class rules, and (figure 8) **PID vs sliding mode vs MPC** with and without an unmodelled yaw disturbance.

## Change log (latest)

* **Fixed:** changing the destination made the ship circle. The planner compared the new route with the old route to the
  already-reached goal and kept the old one. `setGoal()` now discards the old route and forces a re-plan.
* **Added:** real-life features: weather (wind, waves, rain), fuel with an eco-speed energy agent, fault injection, steerage speed, mission 7.
* **Added:** two advanced heading controllers (sliding mode, nonlinear MPC with disturbance observer), live switch (K), metrics scoreboard, `ctrl` column in the CSV and MATLAB figure 8.
* **Added:** CSV export (`O`) and the MATLAB scripts above.
