// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSEA - ROV SIMULATOR
// Sistema de HUD (Heads-Up Display)
// ═══════════════════════════════════════════════════════════════════════════

export class HUD {
  constructor(simulator) {
    this.simulator = simulator;
  }

  init() {
    this.initObjectivesUI();
    this.initTelemetryUI();
  }

  initObjectivesUI() {
    const sim = this.simulator;
    const list = document.getElementById("objectives-list");
    if (!list) return;

    list.innerHTML = "";
    sim.objectives.forEach((obj, index) => {
      const item = document.createElement("div");
      item.className = "objective-item" + (index === 0 ? " active" : "");
      item.id = `objective-${obj.id}`;
      item.innerHTML = `
        <div class="objective-checkbox">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="objective-content">
          <div class="objective-name">${obj.name}</div>
          <div class="objective-desc">${obj.desc}</div>
        </div>
        <div class="objective-points">+${obj.points}</div>
      `;
      list.appendChild(item);
    });
  }

  initTelemetryUI() {
    // Inicializar displays de telemetria
  }

  update() {
    this.updateCompass();
    this.updateDepth();
    this.updateAltitude();
    this.updateSpeed();
    this.updatePosition();
    this.updateHorizon();
    this.updateTelemetry();
    this.updateThrusters();
    this.updateDamage();
  }

  updateCompass() {
    const sim = this.simulator;
    const heading =
      ((((sim.rov.rotation.y * 180) / Math.PI) % 360) + 360) % 360;

    const compassTape = document.getElementById("compass-tape");
    if (compassTape) {
      compassTape.style.transform = `translateX(${-heading * 2}px)`;
    }

    const compassReading = document.getElementById("compass-reading");
    if (compassReading) {
      compassReading.textContent = `${Math.round(heading)}°`;
    }
  }

  updateDepth() {
    const sim = this.simulator;
    const depth = Math.abs(sim.rov.position.y);

    const depthValue = document.getElementById("depth-value");
    if (depthValue) {
      depthValue.textContent = depth.toFixed(1);
    }

    const depthScale = document.getElementById("depth-scale");
    if (depthScale) {
      const offset = (depth % 100) * 3;
      depthScale.style.transform = `translateY(${offset}px)`;
    }
  }

  updateAltitude() {
    const sim = this.simulator;
    const altitude = sim.environment.seabedDepth + sim.rov.position.y;

    const altValue = document.getElementById("altitude-value");
    if (altValue) {
      altValue.textContent = Math.max(0, altitude).toFixed(1);
    }
  }

  updateSpeed() {
    const sim = this.simulator;
    const speed = sim.rov.velocity.length();

    const speedValue = document.getElementById("speed-value");
    if (speedValue) {
      speedValue.textContent = speed.toFixed(1);
    }

    // Knots (1 m/s ≈ 1.94 knots)
    const speedKnots = document.getElementById("speed-knots");
    if (speedKnots) {
      speedKnots.textContent = (speed * 1.94).toFixed(1);
    }
  }

  updatePosition() {
    const sim = this.simulator;
    const pos = sim.rov.position;

    const posX = document.getElementById("pos-x");
    const posY = document.getElementById("pos-y");
    const posZ = document.getElementById("pos-z");

    if (posX) posX.textContent = pos.x.toFixed(1);
    if (posY) posY.textContent = pos.y.toFixed(1);
    if (posZ) posZ.textContent = pos.z.toFixed(1);
  }

  updateHorizon() {
    const sim = this.simulator;
    const pitch = ((sim.cameraPitch || 0) * 180) / Math.PI;
    const roll = (sim.rov.rotation.z * 180) / Math.PI;

    const horizonSky = document.getElementById("horizon-sky");
    if (horizonSky) {
      horizonSky.style.transform = `translateY(${
        pitch * 2
      }px) rotate(${roll}deg)`;
    }

    const pitchIndicator = document.getElementById("pitch-indicator");
    if (pitchIndicator) {
      pitchIndicator.textContent = `${pitch.toFixed(0)}°`;
    }

    const rollIndicator = document.getElementById("roll-indicator");
    if (rollIndicator) {
      rollIndicator.textContent = `${roll.toFixed(0)}°`;
    }
  }

  updateTelemetry() {
    const sim = this.simulator;

    // Temperatura (simulada)
    const temp = 18 + Math.random() * 2;
    const tempEl = document.getElementById("telem-temp");
    if (tempEl) tempEl.textContent = temp.toFixed(1);

    // Pressão (baseada na profundidade)
    const pressure = 1 + Math.abs(sim.rov.position.y) / 10;
    const pressEl = document.getElementById("telem-pressure");
    if (pressEl) pressEl.textContent = pressure.toFixed(1);

    // Bateria (simulada, diminui lentamente)
    const battery = Math.max(0, 100 - sim.sessionTime / 60);
    const battEl = document.getElementById("telem-battery");
    if (battEl) {
      battEl.textContent = battery.toFixed(0);
      battEl.className =
        battery < 20
          ? "telem-value danger"
          : battery < 50
          ? "telem-value warning"
          : "telem-value";
    }
  }

  updateThrusters() {
    const sim = this.simulator;
    const input = sim.input;

    // Calcular thrust de cada propulsor baseado nos inputs
    const thrusts = [
      Math.abs(input.surge + input.yaw) * 50, // Front Left
      Math.abs(input.surge - input.yaw) * 50, // Front Right
      Math.abs(-input.surge + input.yaw) * 50, // Back Left
      Math.abs(-input.surge - input.yaw) * 50, // Back Right
      Math.abs(input.heave + input.sway) * 50, // Vertical FL
      Math.abs(input.heave - input.sway) * 50, // Vertical FR
      Math.abs(input.heave - input.sway) * 50, // Vertical BL
      Math.abs(input.heave + input.sway) * 50, // Vertical BR
    ];

    thrusts.forEach((thrust, i) => {
      const el = document.getElementById(`thruster-${i}`);
      if (el) {
        el.style.setProperty("--thrust", `${Math.min(100, thrust)}%`);
        el.querySelector(".thruster-value").textContent = `${Math.round(
          thrust
        )}%`;
      }
    });
  }

  updateDamage() {
    const sim = this.simulator;

    const damageEl = document.getElementById("status-damage");
    if (damageEl) {
      damageEl.textContent = `${Math.round(sim.damage)}%`;
      damageEl.className =
        sim.damage > 75
          ? "status-value danger"
          : sim.damage > 50
          ? "status-value warning"
          : "status-value";
    }

    // Barra de dano visual
    const damageBar = document.getElementById("damage-bar");
    if (damageBar) {
      damageBar.style.width = `${sim.damage}%`;
      damageBar.style.backgroundColor =
        sim.damage > 75 ? "#ff3344" : sim.damage > 50 ? "#ffaa00" : "#00ff88";
    }
  }

  updateObjective(objective, completed) {
    const el = document.getElementById(`objective-${objective.id}`);
    if (!el) return;

    if (completed) {
      el.classList.remove("active");
      el.classList.add("completed");
    }

    // Ativar próximo objetivo
    const sim = this.simulator;
    const nextObj = sim.objectives.find((o) => !o.completed);
    if (nextObj) {
      const nextEl = document.getElementById(`objective-${nextObj.id}`);
      if (nextEl) nextEl.classList.add("active");
    }
  }

  updateScore() {
    const sim = this.simulator;

    const scoreEl = document.getElementById("score-value");
    if (scoreEl) {
      scoreEl.textContent = sim.score;
    }

    // Calcular grade
    const percentage = (sim.score / sim.totalPossibleScore) * 100;
    const grade =
      percentage >= 90
        ? "S"
        : percentage >= 80
        ? "A"
        : percentage >= 70
        ? "B"
        : percentage >= 60
        ? "C"
        : percentage >= 50
        ? "D"
        : "F";

    const gradeEl = document.getElementById("score-grade");
    if (gradeEl) {
      gradeEl.textContent = `Grade: ${grade}`;
    }
  }

  showWarning(message) {
    const panel = document.getElementById("warning-panel");
    if (!panel) return;

    const warning = document.createElement("div");
    warning.className = "warning-item";
    warning.textContent = message;
    panel.appendChild(warning);

    setTimeout(() => warning.remove(), 5000);
  }

  showMissionComplete() {
    const sim = this.simulator;

    const modal = document.createElement("div");
    modal.id = "mission-complete-modal";
    modal.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 10000;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: 2px solid #00ff88; border-radius: 20px; padding: 40px; text-align: center; max-width: 500px;">
          <h1 style="color: #00ff88; font-size: 48px; margin: 0 0 20px 0;">MISSÃO COMPLETA!</h1>
          <p style="color: #00ff88; font-size: 32px; margin: 20px 0;">Score: ${
            sim.score
          } pts</p>
          <p style="color: #888; font-size: 16px; margin: 20px 0;">Tempo: ${this.formatTime(
            sim.sessionTime
          )}</p>
          <div style="display: flex; gap: 15px; justify-content: center; margin-top: 20px;">
            <button onclick="location.reload()" style="background: #00ff88; color: #000; border: none; padding: 15px 30px; font-size: 16px; border-radius: 10px; cursor: pointer;">JOGAR NOVAMENTE</button>
            <button onclick="history.back()" style="background: #666; color: white; border: none; padding: 15px 30px; font-size: 16px; border-radius: 10px; cursor: pointer;">VOLTAR</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  showMissionFailed() {
    const sim = this.simulator;

    const modal = document.createElement("div");
    modal.id = "mission-failed-modal";
    modal.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 10000;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: 2px solid #ff4444; border-radius: 20px; padding: 40px; text-align: center; max-width: 500px;">
          <h1 style="color: #ff4444; font-size: 48px; margin: 0 0 20px 0;">MISSÃO FALHOU</h1>
          <p style="color: #ff8888; font-size: 24px; margin: 0 0 10px 0;">ROV Destruído - Dano: 100%</p>
          <p style="color: #00ff88; font-size: 32px; margin: 20px 0;">Score: ${sim.score} pts</p>
          <div style="display: flex; gap: 15px; justify-content: center; margin-top: 20px;">
            <button onclick="location.reload()" style="background: #ff4444; color: white; border: none; padding: 15px 30px; font-size: 16px; border-radius: 10px; cursor: pointer;">TENTAR NOVAMENTE</button>
            <button onclick="history.back()" style="background: #666; color: white; border: none; padding: 15px 30px; font-size: 16px; border-radius: 10px; cursor: pointer;">VOLTAR</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map((n) => n.toString().padStart(2, "0")).join(":");
  }
}

export default HUD;
