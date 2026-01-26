export class UpdateHUD {
    constructor(simulator) {
        this.simulator = simulator;
    }

    update() {
        // Atualizar profundidade
        const depth = Math.abs(this.simulator.rov.position.y);
        const depthEl = document.getElementById("depth-value");
        const telemDepth = document.getElementById("telem-depth");
        if (depthEl) depthEl.textContent = depth.toFixed(1);
        if (telemDepth) telemDepth.textContent = depth.toFixed(1);

        // Atualizar altitude
        const altitude = this.simulator.environment.seabedDepth + this.simulator.rov.position.y;
        const altEl = document.getElementById("alt-value");
        const telemAlt = document.getElementById("telem-alt");
        if (altEl) altEl.textContent = Math.max(0, altitude).toFixed(1);
        if (telemAlt) telemAlt.textContent = Math.max(0, altitude).toFixed(1);

        // Atualizar heading
        const heading =
        ((((this.simulator.rov.rotation.y * 180) / Math.PI) % 360) + 360) % 360;
        const compassReading = document.getElementById("compass-reading");
        const telemHdg = document.getElementById("telem-hdg");
        if (compassReading) compassReading.textContent = `${Math.round(heading)}°`;
        if (telemHdg)
        telemHdg.textContent = Math.round(heading).toString().padStart(3, "0");

        // Atualizar compass tape
        const compassTape = document.getElementById("compass-tape");
        if (compassTape) {
        compassTape.style.transform = `translateX(${-heading * 2}px)`;
        }

        // Atualizar velocidade
        const speed = this.simulator.rov.velocity.length();
        const speedKnots = speed * 1.94384;
        const speedEl = document.getElementById("speed-value");
        const telemSpd = document.getElementById("telem-spd");
        if (speedEl)
        speedEl.innerHTML = `${speedKnots.toFixed(
            2,
        )}<span class="unit">kn</span>`;
        if (telemSpd) telemSpd.textContent = speedKnots.toFixed(2);

        // Atualizar posição
        const posX = document.getElementById("pos-x");
        const posY = document.getElementById("pos-y");
        const posZ = document.getElementById("pos-z");
        if (posX) posX.textContent = `${this.simulator.rov.position.x.toFixed(2)} m`;
        if (posY) posY.textContent = `${this.simulator.rov.position.y.toFixed(2)} m`;
        if (posZ) posZ.textContent = `${this.simulator.rov.position.z.toFixed(2)} m`;

        // Atualizar pitch/roll indicators
        const pitchEl = document.getElementById("pitch-indicator");
        const rollEl = document.getElementById("roll-indicator");
        if (pitchEl)
        pitchEl.textContent = `P: ${(
            ((this.simulator.cameraPitch || 0) * 180) /
            Math.PI
        ).toFixed(1)}°`;
        if (rollEl) rollEl.textContent = `R: 0.0°`;

        // Atualizar horizon
        const horizonSky = document.getElementById("horizon-sky");
        if (horizonSky) {
        const pitchDeg = ((this.simulator.cameraPitch || 0) * 180) / Math.PI;
        horizonSky.style.transform = `translateY(${pitchDeg * 2}px)`;
        }

        // Atualizar score
        const scoreEl = document.getElementById("score-value");
        if (scoreEl) scoreEl.textContent = this.simulator.score;

        // Atualizar dano
        const damageBar = document.getElementById("damage-bar");
        const damageValue = document.getElementById("damage-value");
        if (damageBar) {
        const integrity = 100 - this.simulator.damage;
        damageBar.style.width = `${integrity}%`;
        damageBar.style.backgroundColor =
            integrity > 50 ? "#00ff88" : integrity > 25 ? "#ffaa00" : "#ff3344";
        }
        if (damageValue) damageValue.textContent = `${Math.round(this.simulator.damage)}%`;

        // Atualizar status
        const armedEl = document.getElementById("status-armed");
        const speedStatusEl = document.getElementById("status-speed");
        if (armedEl) {
        armedEl.textContent = this.simulator.isArmed ? "YES" : "NO";
        armedEl.className = "status-value" + (this.simulator.isArmed ? "" : " warning");
        }
        if (speedStatusEl) {
        speedStatusEl.textContent = `${Math.round(this.simulator.speedMultiplier * 100)}%`;
        }
    }
}