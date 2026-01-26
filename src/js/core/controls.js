// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSEA - ROV SIMULATOR
// Sistema de Controles (Teclado e Gamepad)
// ═══════════════════════════════════════════════════════════════════════════

export class Controls {
  constructor(simulator) {
    this.simulator = simulator;
    this.keys = {};
    this.gamepadButtonState = [];
    this.deadzone = 0.15;
  }

  init() {
    // Garantir que o documento pode receber foco
    document.body.tabIndex = 0;
    document.body.focus();

    // Eventos de teclado
    document.addEventListener("keydown", (e) => this.onKeyDown(e));
    document.addEventListener("keyup", (e) => this.onKeyUp(e));
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    // Clicar em qualquer lugar dá foco
    document.addEventListener("click", () => document.body.focus());
  }

  onKeyDown(e) {
    this.keys[e.code] = true;
    this.handleKeyAction(e);
  }

  onKeyUp(e) {
    this.keys[e.code] = false;
  }

  handleKeyAction(e) {
    const sim = this.simulator;

    switch (e.code) {
      case "Space":
        e.preventDefault();
        sim.isArmed = !sim.isArmed;
        this.updateArmedStatus();
        sim.addEvent(
          sim.isArmed ? "success" : "warning",
          sim.isArmed ? "ROV Armed" : "ROV Disarmed"
        );
        break;

      case "KeyL":
        sim.lightsOn = !sim.lightsOn;
        this.updateLights();
        sim.addEvent("info", sim.lightsOn ? "Lights ON" : "Lights OFF");
        break;

      case "KeyC":
        this.cycleCamera();
        break;

      case "Escape":
        sim.isPaused = !sim.isPaused;
        break;

      case "ShiftLeft":
      case "ShiftRight":
        sim.speedMultiplier = Math.min(10.0, (sim.speedMultiplier || 1) + 0.5);
        sim.addEvent(
          "info",
          `Speed: ${Math.round(sim.speedMultiplier * 100)}%`
        );
        break;

      case "ControlLeft":
      case "ControlRight":
        sim.speedMultiplier = Math.max(0.25, (sim.speedMultiplier || 1) - 0.25);
        sim.addEvent(
          "info",
          `Speed: ${Math.round(sim.speedMultiplier * 100)}%`
        );
        break;

      case "KeyR":
        if (sim.scenarioConfig.hasRescueROVs) {
          this.handleROVInteraction();
        } else {
          this.registerWaypoint();
        }
        break;

      case "Equal":
      case "NumpadAdd":
        sim.lightPower = Math.min(2.0, sim.lightPower + 0.1);
        this.updateLightPower();
        break;

      case "Minus":
      case "NumpadSubtract":
        sim.lightPower = Math.max(0.1, sim.lightPower - 0.1);
        this.updateLightPower();
        break;
    }
  }

  updateArmedStatus() {
    const sim = this.simulator;
    const el = document.getElementById("status-armed");
    if (el) {
      el.textContent = sim.isArmed ? "YES" : "NO";
      el.className = "status-value " + (sim.isArmed ? "" : "warning");
    }
  }

  updateLights() {
    const sim = this.simulator;
    sim.lights.forEach((l) => {
      if (l.isSpotLight) {
        l.intensity = sim.lightsOn ? 5 * sim.lightPower : 0;
      } else if (l.isPointLight) {
        l.intensity = sim.lightsOn ? 1 * sim.lightPower : 0;
      }
    });

    const el = document.getElementById("status-lights");
    if (el) {
      el.textContent = sim.lightsOn
        ? `${Math.round(sim.lightPower * 100)}%`
        : "OFF";
      el.className = "status-value " + (sim.lightsOn ? "" : "warning");
    }
  }

  updateLightPower() {
    if (this.simulator.lightsOn) {
      this.updateLights();
    }
  }

  cycleCamera() {
    const sim = this.simulator;
    const cameraNames = ["main", "alt", "wide", "external"];
    const currentIndex = cameraNames.indexOf(sim.activeCamera);
    const nextIndex = (currentIndex + 1) % cameraNames.length;
    sim.activeCamera = cameraNames[nextIndex];
    sim.camera = sim.cameras[sim.activeCamera];

    const el = document.getElementById("camera-label");
    if (el) {
      el.textContent = sim.activeCamera.toUpperCase() + " CAM";
    }
    sim.addEvent("info", `Camera: ${sim.activeCamera.toUpperCase()}`);
  }

  handleROVInteraction() {
    // Implementação de anexar/soltar mini-ROVs
    const sim = this.simulator;

    if (sim.attachedROV) {
      // Tentar soltar
      const pos = sim.rov.position;
      const dropZone = sim.dropZone;
      const dist = Math.sqrt(
        Math.pow(pos.x - dropZone.x, 2) + Math.pow(pos.z - dropZone.z, 2)
      );

      if (pos.y > -5 && dist < dropZone.radius) {
        // Soltar ROV na zona de entrega
        sim.rovsCollected++;
        sim.attachedROV = null;
        sim.addEvent("success", `Mini-ROV entregue! (${sim.rovsCollected}/5)`);
      } else {
        sim.addEvent("warning", "Suba até -3m na zona verde para soltar!");
      }
    } else {
      // Tentar anexar
      for (const rov of sim.collectableROVs) {
        if (!rov.collected) {
          const dist = sim.rov.position.distanceTo(rov.position);
          if (dist < 5) {
            sim.attachedROV = rov;
            rov.collected = true;
            sim.addEvent("success", "Mini-ROV anexado! Leve até a superfície.");
            break;
          }
        }
      }
    }
  }

  registerWaypoint() {
    const sim = this.simulator;
    const pos = sim.rov.position;
    sim.addEvent(
      "info",
      `Waypoint: X=${pos.x.toFixed(1)} Y=${pos.y.toFixed(1)} Z=${pos.z.toFixed(
        1
      )}`
    );
  }

  updateInput() {
    const sim = this.simulator;

    if (!sim.isArmed) {
      sim.input = { surge: 0, sway: 0, heave: 0, yaw: 0, pitch: 0, roll: 0 };
      return;
    }

    // Teclado
    let surge = (this.keys["KeyW"] ? 1 : 0) - (this.keys["KeyS"] ? 1 : 0);
    let sway = (this.keys["KeyD"] ? 1 : 0) - (this.keys["KeyA"] ? 1 : 0);
    let heave = (this.keys["KeyQ"] ? 1 : 0) - (this.keys["KeyE"] ? 1 : 0);
    let yaw =
      (this.keys["ArrowLeft"] ? 1 : 0) - (this.keys["ArrowRight"] ? 1 : 0);

    // Pitch da câmera
    const pitchInput =
      (this.keys["ArrowUp"] ? 1 : 0) - (this.keys["ArrowDown"] ? 1 : 0);
    if (pitchInput !== 0) {
      sim.cameraPitch = (sim.cameraPitch || 0) + pitchInput * 0.02;
      sim.cameraPitch = Math.max(-0.8, Math.min(0.8, sim.cameraPitch));
    }

    // Gamepad
    const gamepadInput = this.readGamepad();
    if (gamepadInput) {
      if (Math.abs(gamepadInput.surge) > 0) surge = gamepadInput.surge;
      if (Math.abs(gamepadInput.sway) > 0) sway = gamepadInput.sway;
      if (Math.abs(gamepadInput.heave) > 0) heave = gamepadInput.heave;
      if (Math.abs(gamepadInput.yaw) > 0) yaw = gamepadInput.yaw;
    }

    sim.input.surge = surge;
    sim.input.sway = sway;
    sim.input.heave = heave;
    sim.input.yaw = yaw;
    sim.input.pitch = 0;
  }

  readGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

    for (const gamepad of gamepads) {
      if (!gamepad) continue;

      const applyDeadzone = (value) =>
        Math.abs(value) < this.deadzone ? 0 : value;

      // Sticks
      const leftX = applyDeadzone(gamepad.axes[0] || 0);
      const leftY = applyDeadzone(gamepad.axes[1] || 0);
      const rightX = applyDeadzone(gamepad.axes[2] || 0);
      const rightY = applyDeadzone(gamepad.axes[3] || 0);

      // Triggers
      let triggerUp = 0,
        triggerDown = 0;
      if (gamepad.axes.length > 4) {
        triggerDown = (gamepad.axes[4] + 1) / 2;
        triggerUp = (gamepad.axes[5] + 1) / 2;
      }
      if (gamepad.buttons[6])
        triggerDown = Math.max(triggerDown, gamepad.buttons[6].value);
      if (gamepad.buttons[7])
        triggerUp = Math.max(triggerUp, gamepad.buttons[7].value);

      // Pitch da câmera via stick direito Y
      if (Math.abs(rightY) > 0) {
        this.simulator.cameraPitch =
          (this.simulator.cameraPitch || 0) - rightY * 0.03;
        this.simulator.cameraPitch = Math.max(
          -0.8,
          Math.min(0.8, this.simulator.cameraPitch)
        );
      }

      // Botões de velocidade
      this.handleGamepadButtons(gamepad);

      // Salvar estado dos botões
      this.gamepadButtonState = gamepad.buttons.map((b) => b.pressed);

      return {
        surge: -leftY,
        sway: leftX,
        heave: triggerUp - triggerDown,
        yaw: -rightX,
      };
    }

    return null;
  }

  handleGamepadButtons(gamepad) {
    const sim = this.simulator;

    // L1 - diminuir velocidade
    if (gamepad.buttons[4]?.pressed && !this.gamepadButtonState[4]) {
      sim.speedMultiplier = Math.max(0.25, (sim.speedMultiplier || 1) - 0.5);
      sim.addEvent("info", `Speed: ${Math.round(sim.speedMultiplier * 100)}%`);
    }

    // R1 - aumentar velocidade
    if (gamepad.buttons[5]?.pressed && !this.gamepadButtonState[5]) {
      sim.speedMultiplier = Math.min(20.0, (sim.speedMultiplier || 1) + 0.5);
      sim.addEvent("info", `Speed: ${Math.round(sim.speedMultiplier * 100)}%`);
    }

    // A/X - Arm/Disarm
    if (gamepad.buttons[0]?.pressed && !this.gamepadButtonState[0]) {
      sim.isArmed = !sim.isArmed;
      this.updateArmedStatus();
      sim.addEvent(
        sim.isArmed ? "success" : "warning",
        sim.isArmed ? "ROV Armed" : "ROV Disarmed"
      );
    }

    // B/Circle - Toggle lights
    if (gamepad.buttons[1]?.pressed && !this.gamepadButtonState[1]) {
      sim.lightsOn = !sim.lightsOn;
      this.updateLights();
      sim.addEvent("info", sim.lightsOn ? "Lights ON" : "Lights OFF");
    }

    // Y/Triangle - Toggle camera
    if (gamepad.buttons[3]?.pressed && !this.gamepadButtonState[3]) {
      this.cycleCamera();
    }

    // Start - Pause
    if (gamepad.buttons[9]?.pressed && !this.gamepadButtonState[9]) {
      sim.isPaused = !sim.isPaused;
    }
  }
}

export default Controls;
