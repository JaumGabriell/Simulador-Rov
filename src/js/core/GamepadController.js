// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSEA - ROV SIMULATOR
// Controlador de Gamepad (Xbox, PlayStation, etc.)
// ═══════════════════════════════════════════════════════════════════════════

export class GamepadController {
  constructor(simulator) {
    this.simulator = simulator;
    this.gamepad = null;
    this.connected = false;
    this.deadzone = 0.15;
    this.buttonState = {};
    this.vibrationSupported = false;

    // Mapeamento de botões Xbox
    this.buttonMap = {
      0: "A", // A - Trocar câmera
      1: "B", // B - Pausar
      2: "X", // X - Luzes
      3: "Y", // Y - Armar/Desarmar
      4: "LB", // LB - Diminuir velocidade
      5: "RB", // RB - Aumentar velocidade
      6: "LT", // LT - Descer
      7: "RT", // RT - Subir
      8: "Back", // Back/Select
      9: "Start", // Start - Menu
      10: "LS", // L3 - Pressionar analógico esquerdo
      11: "RS", // R3 - Pressionar analógico direito
      12: "Up", // D-Pad Up
      13: "Down", // D-Pad Down
      14: "Left", // D-Pad Left
      15: "Right", // D-Pad Right
      16: "Home", // Xbox/PS button
    };

    // Mapeamento de eixos
    this.axisMap = {
      0: "leftStickX", // Analógico esquerdo horizontal
      1: "leftStickY", // Analógico esquerdo vertical
      2: "rightStickX", // Analógico direito horizontal
      3: "rightStickY", // Analógico direito vertical
    };
  }

  init() {
    // Detectar conexão de controle
    window.addEventListener("gamepadconnected", (e) => this.onConnect(e));
    window.addEventListener("gamepaddisconnected", (e) => this.onDisconnect(e));

    // Verificar se já existe um controle conectado
    this.checkExistingGamepads();

    console.log("🎮 GamepadController inicializado");
  }

  checkExistingGamepads() {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        this.onConnect({ gamepad: gamepads[i] });
        break;
      }
    }
  }

  onConnect(e) {
    this.gamepad = e.gamepad;
    this.connected = true;
    this.vibrationSupported = "vibrationActuator" in this.gamepad;

    console.log(`🎮 Controle conectado: ${this.gamepad.id}`);

    if (this.simulator.addEvent) {
      this.simulator.addEvent(
        "success",
        `🎮 Controle conectado: ${this.getControllerType()}`
      );
    }

    // Vibrar para confirmar conexão
    this.vibrate(200, 0.5);
  }

  onDisconnect(e) {
    console.log(`🎮 Controle desconectado: ${e.gamepad.id}`);

    if (this.simulator.addEvent) {
      this.simulator.addEvent("warning", "🎮 Controle desconectado");
    }

    this.gamepad = null;
    this.connected = false;
  }

  getControllerType() {
    if (!this.gamepad) return "Desconhecido";

    const id = this.gamepad.id.toLowerCase();
    if (id.includes("xbox")) return "Xbox Controller";
    if (
      id.includes("playstation") ||
      id.includes("dualshock") ||
      id.includes("dualsense")
    )
      return "PlayStation Controller";
    if (id.includes("nintendo") || id.includes("switch"))
      return "Nintendo Controller";
    return "Gamepad";
  }

  // Aplicar deadzone aos valores dos eixos
  applyDeadzone(value) {
    if (Math.abs(value) < this.deadzone) return 0;
    // Normalizar o valor após o deadzone
    const sign = value > 0 ? 1 : -1;
    return (sign * (Math.abs(value) - this.deadzone)) / (1 - this.deadzone);
  }

  // Atualizar estado do gamepad (chamar no loop de animação)
  update() {
    if (!this.connected) return;

    // Atualizar referência do gamepad (necessário em alguns navegadores)
    const gamepads = navigator.getGamepads();
    this.gamepad = gamepads[this.gamepad.index];

    if (!this.gamepad) return;

    // Processar eixos analógicos
    this.processAxes();

    // Processar botões
    this.processButtons();
  }

  processAxes() {
    const sim = this.simulator;
    const gp = this.gamepad;

    // Analógico esquerdo: Movimento (surge/sway)
    const leftX = this.applyDeadzone(gp.axes[0]); // Esquerda/Direita
    const leftY = this.applyDeadzone(gp.axes[1]); // Frente/Trás

    // Analógico direito: Rotação (yaw/pitch)
    const rightX = this.applyDeadzone(gp.axes[2]); // Rotação horizontal
    const rightY = this.applyDeadzone(gp.axes[3]); // Inclinação

    // Triggers: Subir/Descer
    // Em alguns controles, triggers são botões (6, 7)
    // Em outros, são axes (4, 5) com valores de -1 a 1
    let heave = 0;

    // Tentar como botões primeiro (Xbox padrão)
    if (gp.buttons[7]) {
      const rt = gp.buttons[7].value; // RT - Subir
      const lt = gp.buttons[6].value; // LT - Descer
      heave = rt - lt;
    }

    // Aplicar ao input do simulador
    if (sim.input) {
      sim.input.sway = leftX; // Movimento lateral
      sim.input.surge = -leftY; // Movimento frente/trás (invertido)
      sim.input.yaw = -rightX; // Rotação horizontal (invertido para Logitech)
      sim.input.pitch = -rightY * 0.5; // Inclinação (reduzida e invertida)
      sim.input.heave = heave; // Subir/Descer
    }

    // Debug - descomentar para ver valores dos eixos
    // console.log(`L:(${leftX.toFixed(2)}, ${leftY.toFixed(2)}) R:(${rightX.toFixed(2)}, ${rightY.toFixed(2)}) H:${heave.toFixed(2)}`);
  }

  processButtons() {
    const sim = this.simulator;
    const gp = this.gamepad;

    // Verificar cada botão
    for (let i = 0; i < gp.buttons.length; i++) {
      const pressed = gp.buttons[i].pressed;
      const wasPressed = this.buttonState[i] || false;

      // Detectar apenas o momento de pressionar (não segurar)
      if (pressed && !wasPressed) {
        this.onButtonPress(i);
      }

      this.buttonState[i] = pressed;
    }
  }

  onButtonPress(buttonIndex) {
    const sim = this.simulator;
    const buttonName = this.buttonMap[buttonIndex] || `Button${buttonIndex}`;

    console.log(`🎮 Botão: ${buttonName}`);

    switch (buttonIndex) {
      case 0: // A - Trocar câmera
        this.cycleCamera();
        break;

      case 1: // B - Pausar
        sim.isPaused = !sim.isPaused;
        sim.addEvent("info", sim.isPaused ? "Pausado" : "Retomado");
        break;

      case 2: // X - Luzes
        sim.lightsOn = !sim.lightsOn;
        this.updateLights();
        sim.addEvent("info", sim.lightsOn ? "Luzes ON" : "Luzes OFF");
        break;

      case 3: // Y - Armar/Desarmar
        sim.isArmed = !sim.isArmed;
        sim.addEvent(
          sim.isArmed ? "success" : "warning",
          sim.isArmed ? "ROV Armado" : "ROV Desarmado"
        );
        this.vibrate(100, sim.isArmed ? 0.3 : 0.1);
        break;

      case 4: // LB - Diminuir velocidade
        sim.speedMultiplier = Math.max(0.25, (sim.speedMultiplier || 1) - 0.25);
        sim.addEvent(
          "info",
          `Velocidade: ${Math.round(sim.speedMultiplier * 100)}%`
        );
        break;

      case 5: // RB - Aumentar velocidade
        sim.speedMultiplier = Math.min(3.0, (sim.speedMultiplier || 1) + 0.25);
        sim.addEvent(
          "info",
          `Velocidade: ${Math.round(sim.speedMultiplier * 100)}%`
        );
        break;

      case 8: // Back - Trocar modelo ROV
        if (sim.switchROVModel) {
          sim.switchROVModel();
        }
        break;

      case 9: // Start - Menu/Reset
        // Implementar menu se necessário
        break;

      case 10: // L3 - Rotação manual câmera
        if (sim.orbitControl) {
          sim.orbitControl.manualRotation = !sim.orbitControl.manualRotation;
          sim.addEvent(
            "info",
            sim.orbitControl.manualRotation ? "Câmera: Manual" : "Câmera: Auto"
          );
        }
        break;

      case 12: // D-Pad Up - Aumentar luz
        sim.lightPower = Math.min(2.0, (sim.lightPower || 1) + 0.1);
        this.updateLights();
        break;

      case 13: // D-Pad Down - Diminuir luz
        sim.lightPower = Math.max(0.1, (sim.lightPower || 1) - 0.1);
        this.updateLights();
        break;
    }
  }

  cycleCamera() {
    const sim = this.simulator;
    const cameraNames = ["main", "alt", "wide", "external"];
    const currentIndex = cameraNames.indexOf(sim.activeCamera);
    const nextIndex = (currentIndex + 1) % cameraNames.length;
    sim.activeCamera = cameraNames[nextIndex];
    sim.camera = sim.cameras[sim.activeCamera];

    const cameraLabels = {
      main: "Câmera Principal",
      alt: "Câmera Alternativa",
      wide: "Câmera Grande Angular",
      external: "Câmera Externa",
    };

    sim.addEvent("info", `📷 ${cameraLabels[sim.activeCamera]}`);
    this.vibrate(50, 0.2);
  }

  updateLights() {
    const sim = this.simulator;
    if (sim.lights) {
      sim.lights.forEach((l) => {
        if (l.isSpotLight) {
          l.intensity = sim.lightsOn ? 5 * sim.lightPower : 0;
        } else if (l.isPointLight) {
          l.intensity = sim.lightsOn ? 1 * sim.lightPower : 0;
        }
      });
    }
  }

  // Vibrar o controle (feedback háptico)
  vibrate(duration = 200, intensity = 0.5) {
    if (!this.vibrationSupported || !this.gamepad) return;

    try {
      this.gamepad.vibrationActuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration: duration,
        weakMagnitude: intensity,
        strongMagnitude: intensity,
      });
    } catch (e) {
      // Vibração não suportada neste controle
    }
  }

  // Vibrar ao colidir
  vibrateCollision(intensity = 0.8) {
    this.vibrate(300, intensity);
  }

  // Verificar se está conectado
  isConnected() {
    return this.connected;
  }

  // Obter estado atual dos controles
  getState() {
    if (!this.connected || !this.gamepad) return null;

    return {
      leftStick: {
        x: this.applyDeadzone(this.gamepad.axes[0]),
        y: this.applyDeadzone(this.gamepad.axes[1]),
      },
      rightStick: {
        x: this.applyDeadzone(this.gamepad.axes[2]),
        y: this.applyDeadzone(this.gamepad.axes[3]),
      },
      triggers: {
        left: this.gamepad.buttons[6]?.value || 0,
        right: this.gamepad.buttons[7]?.value || 0,
      },
      buttons: this.buttonState,
    };
  }
}

export default GamepadController;
