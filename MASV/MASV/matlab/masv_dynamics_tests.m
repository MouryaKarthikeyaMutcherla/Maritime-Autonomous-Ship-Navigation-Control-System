%% MASV_DYNAMICS_TESTS - ship dynamics + controller verification (base MATLAB, R2016b or newer)
% Same equations, parameters and gains as the web simulator:
%   dynamics    -> src/03_dynamics.js   (deriv, rk4)
%   controllers -> src/07_controllers.js (control)
% Run:  >> masv_dynamics_tests      (opens 7 figures and prints key numbers)
clear; clc; close all;
P  = struct('mx',1,'my',1.5,'Iz',10,'Xu',0.15,'Xuu',0.04,'Yv',1.2,'Yvv',2,'Nr',4,'Nrr',30,'rmax',0.52,'slew',0.3,'Nd',0);
dt = 0.05;
wrapPi = @(a) atan2(sin(a), cos(a));
thff   = @(v) (P.Xu*v + P.Xuu*v^2)/4;            % throttle that holds speed v (drag feed-forward)

%% 1. TURNING CIRCLE  (rudder stepped to 30 deg starboard at 6 m/s)
N = round(150/dt);  X = zeros(6,N);  a = [0;0;0;6;0;0];  rud = 0;  thr = thff(6);
for k = 1:N
    rud = rud + max(min(P.rmax - rud, P.slew*dt), -P.slew*dt);      % slew-limited rudder
    a = rk4step(a, thr, rud, [0;0], P, dt);
    X(:,k) = a;
end
t = (1:N)*dt;
rss = mean(X(6, N-200:N));  Rss = mean(X(4, N-200:N)) / rss;
i180 = find(X(3,:) >= pi, 1);
fprintf('1) Turning circle: steady yaw rate %.1f deg/s, radius %.0f m\n', rss*180/pi, Rss);
if ~isempty(i180)
    fprintf('   Tactical diameter (at 180 deg heading change): %.0f m after %.0f s\n', abs(X(2,i180)), t(i180));
end
figure('Name','1 Turning circle');
subplot(1,2,1); plot(X(1,:), X(2,:), 'b', 'LineWidth', 1.5); axis equal; grid on;
set(gca,'YDir','reverse'); xlabel('x [m]'); ylabel('y [m]'); title('Turning circle (30 deg rudder, 6 m/s)');
subplot(1,2,2); plot(t, X(4,:), 'b', t, X(5,:), 'r', t, X(6,:)*180/pi, 'k', 'LineWidth', 1.2); grid on;
xlabel('time [s]'); legend('surge u [m/s]','sway v [m/s]','yaw rate r [deg/s]'); title('States during the turn');

%% 2. ZIG-ZAG 10/10
N2 = round(120/dt);  Z = zeros(3,N2);  a = [0;0;0;6;0;0];  rud = 0;  sgn = 1;  d10 = 10*pi/180;
for k = 1:N2
    if sgn > 0 && a(3) >= d10
        sgn = -1;
    elseif sgn < 0 && a(3) <= -d10
        sgn = 1;
    end
    rud = rud + max(min(sgn*d10 - rud, P.slew*dt), -P.slew*dt);
    a = rk4step(a, thff(6), rud, [0;0], P, dt);
    Z(:,k) = [a(3); rud; a(6)];
end
t2 = (1:N2)*dt;
fprintf('2) Zig-zag 10/10: heading overshoot %.1f deg\n', max(Z(1,:))*180/pi - 10);
figure('Name','2 Zig-zag');
subplot(2,1,1); plot(t2, Z(1,:)*180/pi, 'b', t2, Z(2,:)*180/pi, 'r--', 'LineWidth', 1.3); grid on;
ylabel('deg'); legend('heading','rudder'); title('Zig-zag 10/10 manoeuvre');
subplot(2,1,2); plot(t2, Z(3,:)*180/pi, 'k', 'LineWidth', 1.3); grid on; xlabel('time [s]'); ylabel('yaw rate [deg/s]');

%% 3. SPEED PI CONTROLLER  (setpoint 6 -> 3 -> 7 m/s)
N3 = round(110/dt);  U = zeros(3,N3);  a = [0;0;0;6;0;0];  thr = thff(6);  si = 0;
for k = 1:N3
    tk = k*dt;
    if tk < 30
        vd = 6;
    elseif tk < 70
        vd = 3;
    else
        vd = 7;
    end
    si  = max(min(si + (vd - a(4))*dt, 8), -8);
    cmd = max(min(thff(vd) + 0.35*(vd - a(4)) + 0.04*si, 1), -0.6);
    thr = thr + (cmd - thr)*min(1, dt*2.5);               % throttle actuator lag
    a   = rk4step(a, thr, 0, [0;0], P, dt);
    U(:,k) = [a(4); vd; thr];
end
t3 = (1:N3)*dt;
figure('Name','3 Speed PI');
subplot(2,1,1); plot(t3, U(1,:), 'b', t3, U(2,:), 'r--', 'LineWidth', 1.4); grid on;
ylabel('speed [m/s]'); legend('u','desired'); title('Speed PI controller (feed-forward + P + I)');
subplot(2,1,2); plot(t3, U(3,:)*100, 'k', 'LineWidth', 1.3); grid on; xlabel('time [s]'); ylabel('throttle [%]');

%% 4. HEADING PID  (0 -> 60 deg step; gain scheduling on/off at low speed)
[ta, pa, ra] = heading_run(6, 60, true,  P, dt);
[tb, pb, rb] = heading_run(3, 60, true,  P, dt);
[tc, pc, rc] = heading_run(3, 60, false, P, dt);
figure('Name','4 Heading PID');
subplot(2,1,1); plot(ta, pa, 'b', tb, pb, 'g', tc, pc, 'r', ta, 60*ones(size(ta)), 'k:', 'LineWidth', 1.4); grid on;
ylabel('heading [deg]'); legend('6 m/s, scheduled','3 m/s, scheduled','3 m/s, NO scheduling','command','Location','southeast');
title('Heading PID step response');
subplot(2,1,2); plot(ta, ra, 'b', tb, rb, 'g', tc, rc, 'r', 'LineWidth', 1.3); grid on;
xlabel('time [s]'); ylabel('rudder [deg]'); title('Rudder (limit 30 deg, slew 17 deg/s)');

%% 5. LOS GUIDANCE WITH CROSS-CURRENT  (route along y = 0, start 60 m off, current 0.6 m/s)
[tl, y1] = los_run(true,  P, dt);
[~,  y2] = los_run(false, P, dt);
figure('Name','5 LOS + current compensation');
plot(tl, y1, 'b', tl, y2, 'r', tl, zeros(size(tl)), 'k:', 'LineWidth', 1.5); grid on;
xlabel('time [s]'); ylabel('cross-track error y [m]'); legend('with crab compensation','without','route');
title('Line-of-sight guidance under a 0.6 m/s cross-current');

%% 6. WHIRLPOOL FLOW FIELD  (curAt) and keep-out ring
R = 120;  [gx, gy] = meshgrid(-350:10:350, -350:10:350);
d  = hypot(gx, gy) + 1e-6;
m  = 3.5*exp(-((d - 0.8*R)/(0.7*R)).^2);  m(d > 2.6*R) = 0;
cx = m.*(-gy./d) - 0.35*m.*gx./d;   cy = m.*(gx./d) - 0.35*m.*gy./d;
figure('Name','6 Whirlpool'); contourf(gx, gy, hypot(cx,cy), 12); colorbar; hold on;
quiver(gx(1:3:end,1:3:end), gy(1:3:end,1:3:end), cx(1:3:end,1:3:end), cy(1:3:end,1:3:end), 'k');
th = linspace(0, 2*pi, 200);
plot(1.5*R*cos(th), 1.5*R*sin(th), 'w--', 'LineWidth', 2);
axis equal; set(gca,'YDir','reverse'); title('Whirlpool current [m/s]; dashed = planner keep-out ring (1.5 R)');

%% 7. COMMUNICATION TOPOLOGY RULES  (09_topology.js)
rad = 0:1:320;  code = 2*ones(size(rad));            % 2 = CHAIN/RELAY
code(rad < 260) = 3;  code(rad < 170) = 4;  code(rad < 110) = 5;
figure('Name','7 Topology rules');
subplot(2,1,1); stairs(rad, code, 'LineWidth', 2); grid on; ylim([1.5 5.5]);
set(gca,'YTick',[2 3 4 5],'YTickLabel',{'CHAIN/RELAY','RING','MESH','DENSE MESH'});
xlabel('fleet radius (max escort distance from ship) [m]'); title('Topology chosen when no hostile is engaged (STAR is used in combat)');
dd = 0:1:300;  cls = 4*ones(size(dd));  cls(dd < 260) = 3;  cls(dd < 170) = 2;  cls(dd < 100) = 1;
subplot(2,1,2); stairs(dd, cls, 'LineWidth', 2); grid on; ylim([0.5 4.5]);
set(gca,'YTick',[1 2 3 4],'YTickLabel',{'STRONG','WEAK','RELAY','NO LINK'});
xlabel('link distance [m]'); title('Link class vs distance');

%% 8. ADVANCED HEADING CONTROLLERS: PID vs SLIDING MODE vs MPC  (07_controllers.js: smc, mpc)
% Reference: 0 -> 60 deg at t = 0, back to 0 deg at t = 35 s.  Case 2 adds an unmodelled yaw moment (wind-like disturbance).
cases = {6, 0; 6, 0.6; 3, 0};   names = {'PID','Sliding mode','MPC'};
figure('Name','8 PID vs SMC vs MPC');
for c = 1:3
    for mo = 0:2
        [t8, psiD, rudD, Mt] = heading_cmp(cases{c,1}, cases{c,2}, mo, P, dt);
        subplot(3,2,2*c-1); hold on; plot(t8, psiD, 'LineWidth', 1.4);
        subplot(3,2,2*c);   hold on; plot(t8, rudD, 'LineWidth', 1.4);
        fprintf('%-13s u=%.0f m/s, yaw disturbance %.1f : overshoot %5.1f deg, IAE %5.1f, rudder travel %4.0f deg\n', names{mo+1}, cases{c,1}, cases{c,2}, Mt.os, Mt.iae, Mt.tv);
    end
    subplot(3,2,2*c-1); grid on; ylabel('heading [deg]'); title(sprintf('u = %.0f m/s, disturbance %.1f', cases{c,1}, cases{c,2}));
    if c == 1, legend(names, 'Location', 'east'); end
    subplot(3,2,2*c); grid on; ylabel('rudder [deg]');
end
subplot(3,2,5); xlabel('time [s]'); subplot(3,2,6); xlabel('time [s]');

%% 9. FUEL MODEL AND ECO SPEED  (control(): energy agent)
% fuel rate = 0.55*(throttle^3 + 0.02) [% per s]; throttle that holds speed v = (Xu*v + Xuu*v^2)/4
v = 2:0.1:8;  th = (P.Xu*v + P.Xuu*v.^2)/4;  rate = 0.55*(th.^3 + 0.02);
figure('Name','9 Fuel model');
subplot(2,1,1); plot(v, rate*60, 'LineWidth', 1.5); grid on; xlabel('speed [m/s]'); ylabel('fuel rate [% per min]'); title('Fuel rate follows a cubic law');
subplot(2,1,2); plot(v, 100*v./rate, 'LineWidth', 1.5); grid on; xlabel('speed [m/s]'); ylabel('range of a full tank [m]'); title('Range vs speed: slower is far more efficient');

%% 10. WEATHER MODEL (updEnv) AND MINIMUM STEERAGE SPEED
tt = 0:0.1:120;  Vw = [0 8 16];  Hs = [0 1.2 3];
figure('Name','10 Weather model');
for k = 1:3
    V  = Vw(k)*(1 + 0.25*sin(tt*0.37) + 0.15*sin(tt*1.1 + 1));
    nr = 0.02*Hs(k)*sin(0.9*tt) + 0.012*Hs(k)*sin(1.7*tt + 2);
    subplot(3,2,2*k-1); plot(tt, V); grid on; ylabel('wind [m/s]'); title(sprintf('wind %.0f m/s, Hs %.1f m', Vw(k), Hs(k)));
    subplot(3,2,2*k);   plot(tt, nr); grid on; ylabel('wave yaw acc [rad/s^2]');
end
subplot(3,2,5); xlabel('time [s]'); subplot(3,2,6); xlabel('time [s]');
u = 2:0.1:8;  auth = 0.0123*u.^2*0.52;                 % yaw acceleration the rudder can deliver
figure('Name','11 Steerage speed'); plot(u, auth, 'LineWidth', 1.8); hold on; grid on;
plot([2 8], [0.043 0.043], 'g--', [2 8], [0.116 0.116], 'r--');
xlabel('speed [m/s]'); ylabel('rudder yaw authority [rad/s^2]');
legend('rudder authority','breeze disturbance','storm disturbance','Location','northwest');
title('Below the steerage speed the weather overpowers the rudder (storm: about 5 m/s)');

%% ---------------- local functions (must stay at the end of the file) ----------------
function d = deriv(a, thr, rud, cu, P)
    psi = a(3); u = a(4); v = a(5); r = a(6);
    T = 4*thr;  if thr < 0, T = 4*thr*0.6; end
    du = (T - (P.Xu*u + P.Xuu*abs(u)*u) + P.my*v*r) / P.mx;
    dv = (0.03*u*abs(u)*rud - (P.Yv*v + P.Yvv*abs(v)*v) - P.mx*u*r) / P.my;
    dr = (0.123*u*abs(u)*rud - (P.Nr*r + P.Nrr*abs(r)*r) + (P.mx - P.my)*u*v + P.Nd) / P.Iz;
    d  = [u*cos(psi) - v*sin(psi) + cu(1); u*sin(psi) + v*cos(psi) + cu(2); r; du; dv; dr];
end

function a = rk4step(a, thr, rud, cu, P, dt)
    k1 = deriv(a,             thr, rud, cu, P);
    k2 = deriv(a + 0.5*dt*k1, thr, rud, cu, P);
    k3 = deriv(a + 0.5*dt*k2, thr, rud, cu, P);
    k4 = deriv(a + dt*k3,     thr, rud, cu, P);
    a  = a + dt*(k1 + 2*k2 + 2*k3 + k4)/6;
end

function [rc, ei] = hdg_pid(e, r, u, ei, dt, P, useSched)
    sc = 1;
    if useSched, sc = min(max(36/max(u*u, 9), 1), 4); end
    ei = max(min(ei + e*dt, 0.5), -0.5);
    rc = max(min(sc*(0.9*e - 2.5*r) + 0.02*ei, P.rmax), -P.rmax);
end

function [t, psi, rud] = heading_run(u0, cmdDeg, useSched, P, dt)
    N = round(60/dt);  a = [0;0;0;u0;0;0];  rd = 0;  ei = 0;
    thr = (P.Xu*u0 + P.Xuu*u0^2)/4;  psi = zeros(1,N);  rud = zeros(1,N);
    for k = 1:N
        e = atan2(sin(cmdDeg*pi/180 - a(3)), cos(cmdDeg*pi/180 - a(3)));
        [rc, ei] = hdg_pid(e, a(6), a(4), ei, dt, P, useSched);
        rd = rd + max(min(rc - rd, P.slew*dt), -P.slew*dt);
        a  = rk4step(a, thr, rd, [0;0], P, dt);
        psi(k) = a(3)*180/pi;  rud(k) = rd*180/pi;
    end
    t = (1:N)*dt;
end

function [t, y] = los_run(comp, P, dt)
    N = round(200/dt);  a = [0;60;0;6;0;0];  cu = [0;0.6];  rd = 0;  ei = 0;  si = 0;  thr = (P.Xu*6 + P.Xuu*36)/4;  y = zeros(1,N);
    for k = 1:N
        D = 35 + 6*max(a(4), 0);
        psid = atan2(0 - a(2), D);                      % carrot D metres ahead on the route y = 0
        if comp
            cn = -cu(1)*sin(psid) + cu(2)*cos(psid);   % cross-current component
            psid = psid - asin(max(min(cn/max(3, hypot(a(4), a(5))), 0.6), -0.6));
        end
        e = atan2(sin(psid - a(3)), cos(psid - a(3)));
        [rc, ei] = hdg_pid(e, a(6), a(4), ei, dt, P, true);
        rd = rd + max(min(rc - rd, P.slew*dt), -P.slew*dt);
        si = max(min(si + (6 - a(4))*dt, 8), -8);
        thr = max(min((P.Xu*6 + P.Xuu*36)/4 + 0.35*(6 - a(4)) + 0.04*si, 1), -0.6);
        a = rk4step(a, thr, rd, cu, P, dt);
        y(k) = a(2);
    end
    t = (1:N)*dt;
end

function [rc, si] = smc_ctrl(e, r, u, si, dt)
    % Sliding-mode heading controller (boundary layer + integral action)
    % surface sigma = 0.6*e - r ;  reaching law  dsigma = -1.0*sigma - 0.06*sat(sigma/0.2)
    uu = max(abs(u), 3);  b = 0.0123*uu^2;  sig = 0.6*e - r;
    si = max(min(si + sig*dt, 1), -1);
    rc = ((0.4 - 0.6)*r + 1.0*sig + 0.06*max(min(sig/0.2, 1), -1))/b + 0.04*si;
    rc = max(min(rc, 0.52), -0.52);
end

function [rc, O] = mpc_ctrl(e, r, rd0, u, O, dts)
    % Nonlinear MPC: 16 steps x 0.35 s, rudder plan = two held values (9 x 9 candidates),
    % rudder limit 0.52 rad, slew 0.3 rad/s, disturbance observer O.d (yaw acceleration bias)
    uu = max(u, 2);  kd = 0.0123*uu^2;  N = 16;  h = 0.35;  sw0 = 6;  tg = -0.52:0.13:0.52;
    if ~isnan(O.pr) && dts < 0.5
        mdl = kd*rd0 - (0.4*r + 3*abs(r)*r);
        O.d = max(min(O.d + 0.35*((r - O.pr)/dts - mdl - O.d), 0.15), -0.15);
    end
    O.pr = r;  best = inf;  rc = 0;
    for d1 = tg
        for d2 = tg
            psi = 0;  rr = r;  rd = rd0;  J = 0.3*(d2 - d1)^2;
            for k = 1:N
                if k <= sw0, T = d1; else, T = d2; end
                rd = rd + max(min(T - rd, 0.3*h), -0.3*h);
                rr = rr + h*(kd*rd - (0.4*rr + 3*abs(rr)*rr) + O.d);
                psi = psi + h*rr;  ek = e - psi;
                J = J + ek^2 + 1.5*rr^2 + 0.15*rd^2;
            end
            J = J + 6*(e - psi)^2;
            if J < best, best = J; rc = d1; end
        end
    end
end

function [t, psiD, rudD, Mt] = heading_cmp(u0, Nd, mode, P, dt)
    P.Nd = Nd;  N = round(70/dt);  a = [0;0;0;u0;0;0];  rd = 0;  ei = 0;  si = 0;
    thr = (P.Xu*u0 + P.Xuu*u0^2)/4;  mpcCmd = 0;  tSolve = -9;  O.pr = NaN;  O.d = 0;
    psiD = zeros(1,N);  rudD = zeros(1,N);  iae = 0;  tv = 0;  prev = 0;
    for k = 1:N
        tk = k*dt;  ref = 60*pi/180*(tk < 35);
        e = atan2(sin(ref - a(3)), cos(ref - a(3)));
        switch mode
            case 0
                [rc, ei] = hdg_pid(e, a(6), a(4), ei, dt, P, true);
            case 1
                [rc, si] = smc_ctrl(e, a(6), a(4), si, dt);
            otherwise
                if tk - tSolve >= 0.2
                    [mpcCmd, O] = mpc_ctrl(e, a(6), rd, a(4), O, tk - tSolve);
                    tSolve = tk;
                end
                rc = mpcCmd;
        end
        rd = rd + max(min(rc - rd, P.slew*dt), -P.slew*dt);
        a  = rk4step(a, thr, rd, [0;0], P, dt);
        psiD(k) = a(3)*180/pi;  rudD(k) = rd*180/pi;
        iae = iae + abs(e)*dt;  tv = tv + abs(rd - prev);  prev = rd;
    end
    t = (1:N)*dt;
    Mt.os = max(psiD(1:round(35/dt))) - 60;  Mt.iae = iae;  Mt.tv = tv*180/pi;
end
