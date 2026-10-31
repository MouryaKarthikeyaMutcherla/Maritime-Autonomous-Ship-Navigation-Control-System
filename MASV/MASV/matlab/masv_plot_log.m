%% MASV_PLOT_LOG - plot telemetry exported from the web simulator
% 1) In the simulator press  O  (or the "Export CSV" button) -> downloads masv_log.csv + masv_scene.csv
% 2) In MATLAB run:  >> masv_plot_log     (looks in the current folder, then in ~/Downloads)
clear; close all; clc;
dl = fullfile(getenv('USERPROFILE'), 'Downloads');
if isempty(getenv('USERPROFILE')), dl = fullfile(getenv('HOME'), 'Downloads'); end
logFile = pick_newest('masv_log*.csv', {pwd, dl});
sceneFile = pick_newest('masv_scene*.csv', {pwd, dl});
if isempty(logFile)
    [f, p] = uigetfile('*.csv', 'Select masv_log.csv');  logFile = fullfile(p, f);
end
fprintf('Reading %s\n', logFile);
T = readtable(logFile);
ctrlNames = {'PID','Sliding mode','MPC'};  cn = 'PID';
if ismember('ctrl', T.Properties.VariableNames), cn = ctrlNames{mode(T.ctrl) + 1}; end
t = T.t;  wrapPi = @(a) atan2(sin(a), cos(a));  kn = 1.944;

%% Figure 1 - trajectory with hazards, escorts and speed colouring
figure('Name','Trajectory'); hold on; grid on;
if ~isempty(sceneFile)
    S = readtable(sceneFile);
    for i = 1:height(S)
        ty = char(string(S.type(i)));  x = S.x(i);  y = S.y(i);  r = S.r(i);
        switch ty
            case 'island', c = [0.35 0.75 0.45];
            case 'rock',   c = [0.55 0.55 0.55];
            case 'berg',   c = [0.80 0.95 1.00];
            case 'whirl',  c = [0.75 0.55 1.00];
            case 'enemy',  c = [1.00 0.30 0.30];
            otherwise,     c = [];
        end
        if ~isempty(c) && r > 0
            rectangle('Position',[x-r y-r 2*r 2*r],'Curvature',[1 1],'FaceColor',c,'EdgeColor','k');
            if strcmp(ty,'whirl'), rectangle('Position',[x-1.5*r y-1.5*r 3*r 3*r],'Curvature',[1 1],'LineStyle','--','EdgeColor',[0.5 0.2 0.8]); end
        elseif strcmp(ty,'start'), plot(x, y, 'ks', 'MarkerFaceColor','w', 'MarkerSize', 9);
        elseif strcmp(ty,'goal'),  plot(x, y, 'g^', 'MarkerFaceColor','g', 'MarkerSize', 11);
        end
    end
end
for i = 1:6
    plot(T.(sprintf('e%d_x',i)), T.(sprintf('e%d_y',i)), ':', 'Color', [0.3 0.7 0.9]);
end
scatter(T.x, T.y, 10, T.u*kn, 'filled'); colorbar;
axis equal; xlim([0 1600]); ylim([0 1000]); set(gca,'YDir','reverse');
xlabel('x [m]'); ylabel('y [m]'); title('Ship trajectory (colour = speed [kn]); dotted = escorts');

%% Figure 2 - controller performance
psiU = unwrap(T.psi);  cmdU = psiU + wrapPi(T.psi_cmd - T.psi);
figure('Name','Controller performance');
a1 = subplot(5,1,1); plot(t, rad2deg(psiU), 'b', t, rad2deg(cmdU), 'r--'); grid on; ylabel('heading [deg]'); legend('\psi','\psi_{cmd}'); title(['Heading controller: ' cn]);
a2 = subplot(5,1,2); plot(t, rad2deg(wrapPi(T.psi_cmd - T.psi)), 'k'); grid on; ylabel('error [deg]');
a3 = subplot(5,1,3); yyaxis left; plot(t, rad2deg(T.rud)); ylabel('rudder [deg]'); yyaxis right; plot(t, rad2deg(T.r)); ylabel('yaw rate [deg/s]'); grid on;
a4 = subplot(5,1,4); plot(t, T.u*kn, 'b', t, T.v_des*kn, 'r--'); grid on; ylabel('speed [kn]'); legend('u','desired (auto)');
a5 = subplot(5,1,5); plot(t, T.thr*100, 'k'); grid on; ylabel('throttle [%]'); xlabel('time [s]');
linkaxes([a1 a2 a3 a4 a5], 'x');

%% Figure 3 - guidance, risk, safety
figure('Name','Guidance and safety');
b1 = subplot(4,1,1); plot(t, abs(T.cte)); grid on; ylabel('cross-track [m]'); title('Guidance and safety');
b2 = subplot(4,1,2); plot(t, T.risk); grid on; ylabel('route risk');
b3 = subplot(4,1,3); plot(t, T.cpa); grid on; ylabel('CPA clearance [m]'); ylim([0 400]);
b4 = subplot(4,1,4); plot(t, T.hp, 'r', 'LineWidth', 1.5); grid on; ylabel('hull [%]'); xlabel('time [s]'); ylim([0 105]);
linkaxes([b1 b2 b3 b4], 'x');

%% Figure 4 - adaptive communication
topo = string(T.topology);  [names, ~, code] = unique(topo, 'stable');
figure('Name','Communication topology');
c1 = subplot(4,1,1); stairs(t, code, 'LineWidth', 1.8); grid on; ylim([0.5 numel(names)+0.5]);
set(gca, 'YTick', 1:numel(names), 'YTickLabel', cellstr(names)); title('Topology in use');
c2 = subplot(4,1,2); area(t, [T.n_strong T.n_weak T.n_relay T.n_none]); grid on; ylabel('pairs');
colormap(c2, [0.30 1.00 0.60; 1.00 0.88 0.30; 1.00 0.60 0.24; 0.50 0.50 0.50]); legend('strong','weak','relay','none','Location','eastoutside');
c3 = subplot(4,1,3); hold on; for i = 1:6, plot(t, T.(sprintf('e%d_d',i))); end; grid on; ylabel('dist to ship [m]'); legend('E1','E2','E3','E4','E5','E6','Location','eastoutside');
c4 = subplot(4,1,4); hold on; for i = 1:6, plot(t, T.(sprintf('e%d_hp',i))); end; grid on; ylabel('escort HP [%]'); xlabel('time [s]');
linkaxes([c1 c2 c3 c4], 'x');
if ismember('fuel', T.Properties.VariableNames)
    figure('Name','Weather, fuel and faults');
    d1 = subplot(3,1,1); plot(t, T.fuel, 'LineWidth', 1.5); grid on; ylabel('fuel [%]'); title('Fuel, weather and faults');
    d2 = subplot(3,1,2); plot(t, T.wind); hold on; plot(t, T.hs*5, '--'); grid on; ylabel('wind [m/s]'); legend('wind','5 x wave height');
    d3 = subplot(3,1,3); stairs(t, T.fault, 'LineWidth', 1.5); grid on; xlabel('time [s]');
    set(gca, 'YTick', 0:3, 'YTickLabel', {'none','engine','rudder','radar'}); ylim([-0.5 3.5]);
    linkaxes([d1 d2 d3], 'x');
end
fprintf('Done: %d samples, %.0f s, final hull %.0f %%.\n', height(T), t(height(T)), T.hp(height(T)));

%% ---------------- local functions ----------------
function f = pick_newest(pattern, folders)
    f = '';  best = -inf;
    for i = 1:numel(folders)
        d = dir(fullfile(folders{i}, pattern));
        for j = 1:numel(d)
            if d(j).datenum > best, best = d(j).datenum;  f = fullfile(folders{i}, d(j).name); end
        end
    end
end
