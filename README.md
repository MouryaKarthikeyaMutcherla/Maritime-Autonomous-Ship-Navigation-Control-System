# Maritime Autonomous Ship Navigation & Control System (MASV)

An integrated simulation framework for autonomous maritime navigation, intelligent path planning, collision avoidance, and multi-vessel coordination.

## Overview

The **Maritime Autonomous Ship Navigation & Control System (MASV)** is a simulation-based project designed to explore autonomous vessel navigation using mathematical ship modelling, intelligent path-planning algorithms, advanced control strategies, and multi-agent coordination.

The system combines a three-degree-of-freedom (3-DOF) ship dynamics model with numerical integration, guidance algorithms, risk-aware path planning, predictive collision detection, and cooperative fleet control.

The project also explores coordination among six autonomous vessels using dynamic formation control and adaptive communication topologies.

## Key Features

### 1. Ship Dynamics Modelling
- Three-degree-of-freedom (3-DOF) hydrodynamic ship model.
- Fourth-order Runge-Kutta (RK4) numerical integration.
- Simulation of autonomous vessel movement and navigation dynamics.

### 2. Autonomous Guidance and Path Planning
- Line-of-Sight (LOS) guidance for vessel navigation.
- Risk-aware A* path-planning algorithm.
- Navigation through dynamically changing environments.

### 3. Collision Detection and Avoidance
- Predictive collision detection.
- Risk-aware obstacle avoidance.
- Path adjustment for safer autonomous navigation.

### 4. Advanced Control Systems
Multiple control strategies are integrated for vessel heading and navigation control:

- **PID Control:** Conventional feedback-based control.
- **Sliding Mode Control (SMC):** Robust control under disturbances and uncertainties.
- **Nonlinear Model Predictive Control (NMPC):** Predictive control for adaptive navigation.

### 5. Multi-Agent Fleet Coordination
- Coordination of six autonomous vessels.
- Dynamic multi-vessel formation control.
- Adaptive fleet communication topologies.
- Exploration of Mesh, Ring, Star, and Relay communication structures.

## System Architecture

The system integrates the following major components:

1. **Ship Dynamics:** Models vessel motion using a 3-DOF mathematical model.
2. **Path Planning:** Generates navigation paths using risk-aware A*.
3. **Guidance:** Uses LOS guidance to follow planned paths.
4. **Collision Avoidance:** Predicts potential collisions and supports obstacle avoidance.
5. **Control Layer:** Applies PID, Sliding Mode Control, and NMPC.
6. **Fleet Coordination:** Coordinates multiple autonomous vessels through formation control and communication topologies.

## Technology Stack

| Technology | Application |
|---|---|
| MATLAB | Ship dynamics modelling, numerical simulation, and control algorithms |
| JavaScript | Application and simulation-related development |
| RK4 | Numerical integration |
| A* | Risk-aware path planning |
| LOS | Autonomous guidance |
| PID | Feedback control |
| SMC | Robust control |
| NMPC | Predictive navigation control |

## Project Objectives

- Develop a simulation-based autonomous ship navigation framework.
- Integrate mathematical vessel modelling with intelligent navigation algorithms.
- Explore predictive collision avoidance and risk-aware path planning.
- Compare and integrate different vessel control strategies.
- Investigate multi-agent coordination for autonomous maritime fleets.

## Potential Applications

- Autonomous maritime navigation research.
- Intelligent vessel guidance and control.
- Collision avoidance and maritime safety simulation.
- Multi-vessel coordination and fleet management.
- Research in autonomous marine systems.

## Future Enhancements

- Integration of more realistic environmental disturbances, including wind, waves, and ocean currents.
- Extended fleet coordination and scalability.
- Improved real-time collision avoidance.
- Integration with maritime simulation environments and visualization tools.
- Exploration of hardware-in-the-loop testing.

## Disclaimer

MASV is a simulation-based academic and development project. Its algorithms and results are intended for research and experimentation and should not be considered validated for deployment on real autonomous vessels.

## Author

**Mourya Karthikeya Mutcherla**

Artificial Intelligence Engineering  
Amrita Vishwa Vidyapeetham

[GitHub Profile](https://github.com/MouryaKarthikeyaMutcherla)

---

*Exploring intelligent navigation, autonomous control, and cooperative maritime systems.*
