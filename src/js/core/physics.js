// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSEA - ROV SIMULATOR
// Sistema de Física do ROV
// ═══════════════════════════════════════════════════════════════════════════

export class Physics {
  constructor(simulator) {
    this.simulator = simulator;

    // Constantes físicas - Simulação realista subaquática
    this.maxSpeed = 25; // m/s base
    this.maxAngularSpeed = 10.0; // rad/s
    this.acceleration = 15.0; // Aceleração mais suave
    this.angularAcceleration = 8.0; // Rotação mais suave

    // Inércia subaquática - valores mais próximos de 1.0 = mais inércia
    // ROV real leva 2-4 segundos para parar completamente
    this.linearDrag = 0.985; // Arrasto linear (desacelera ~1.5% por frame)
    this.angularDrag = 0.975; // Arrasto angular (rotação para mais rápido)

    // Massa virtual do ROV (afeta quanto tempo leva para acelerar/desacelerar)
    this.mass = 150; // kg (ROV típico de trabalho)
    this.addedMass = 50; // kg (massa adicionada pela água)
    this.effectiveMass = this.mass + this.addedMass;
  }

  update(dt) {
    if (this.simulator.isPaused) return;

    const speedMult = this.simulator.speedMultiplier || 1.0;
    const maxSpeed = this.maxSpeed * speedMult;
    const acceleration = this.acceleration * speedMult;

    const rov = this.simulator.rov;
    const input = this.simulator.input;
    const yaw = rov.rotation.y;
    const pitch = this.simulator.cameraPitch || 0;

    // Vetores de direção baseados na rotação do ROV
    const forwardHorizontal = new THREE.Vector3(
      Math.cos(yaw),
      0,
      -Math.sin(yaw)
    );
    const right = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const up = new THREE.Vector3(0, 1, 0);

    // Calcular direção de movimento
    const moveDir = new THREE.Vector3();

    // Surge (frente/trás) - considera pitch da câmera
    if (input.surge !== 0) {
      const forwardWithPitch = forwardHorizontal.clone();
      forwardWithPitch.y = -Math.sin(pitch) * Math.abs(input.surge);
      forwardWithPitch.normalize();
      moveDir.addScaledVector(forwardWithPitch, input.surge);
    }

    // Sway (esquerda/direita)
    moveDir.addScaledVector(right, input.sway);

    // Heave (subir/descer)
    moveDir.addScaledVector(up, input.heave);

    // ═══════════════════════════════════════════════════════════════
    // SISTEMA DE INÉRCIA REALISTA
    // ═══════════════════════════════════════════════════════════════

    // Calcular força dos propulsores (F = m * a)
    const thrusterForce = acceleration * this.effectiveMass;

    // Aplicar força na direção do movimento
    if (moveDir.length() > 0) {
      moveDir.normalize();
      // F = m * a, então a = F / m
      const accel = thrusterForce / this.effectiveMass;
      rov.velocity.addScaledVector(moveDir, accel * dt);
    }

    // Aplicar arrasto hidrodinâmico (resistência da água)
    // Arrasto quadrático: mais rápido = mais resistência
    const speed = rov.velocity.length();
    if (speed > 0.001) {
      // Coeficiente de arrasto baseado na velocidade
      const dragCoeff = 1 - Math.pow(this.linearDrag, dt * 60);

      // Aplicar arrasto proporcional à velocidade
      rov.velocity.multiplyScalar(1 - dragCoeff);

      // Parar completamente se velocidade muito baixa
      if (rov.velocity.length() < 0.01) {
        rov.velocity.set(0, 0, 0);
      }
    }

    // Limitar velocidade máxima
    if (rov.velocity.length() > maxSpeed) {
      rov.velocity.normalize().multiplyScalar(maxSpeed);
    }

    // Atualizar posição
    rov.position.addScaledVector(rov.velocity, dt);

    // ═══════════════════════════════════════════════════════════════
    // ROTAÇÃO COM INÉRCIA
    // ═══════════════════════════════════════════════════════════════

    const angularAccel = this.angularAcceleration * speedMult;

    // Aplicar torque dos propulsores
    if (input.yaw !== 0) {
      rov.angularVelocity.y += input.yaw * angularAccel * dt;
    }

    // Aplicar arrasto angular
    const angularDragCoeff = 1 - Math.pow(this.angularDrag, dt * 60);
    rov.angularVelocity.y *= 1 - angularDragCoeff;

    // Parar rotação se muito lenta
    if (Math.abs(rov.angularVelocity.y) < 0.001) {
      rov.angularVelocity.y = 0;
    }

    // Limitar velocidade angular
    const maxAngular = this.maxAngularSpeed * speedMult;
    rov.angularVelocity.y = Math.max(
      -maxAngular,
      Math.min(maxAngular, rov.angularVelocity.y)
    );

    // Aplicar rotação
    rov.rotation.y += rov.angularVelocity.y * dt;

    // Aplicar corrente marinha
    this.applyCurrents(dt);

    // Limites do ambiente
    this.applyBoundaries();
  }

  applyCurrents(dt) {
    const env = this.simulator.environment;
    const rov = this.simulator.rov;

    if (env.currentX || env.currentY) {
      rov.position.x += (env.currentX || 0) * dt;
      rov.position.z += (env.currentY || 0) * dt;
    }
  }

  applyBoundaries() {
    const rov = this.simulator.rov;
    const seabedDepth = this.simulator.environment.seabedDepth;

    // Limite superior (superfície)
    if (rov.position.y > -1) {
      rov.position.y = -1;
      rov.velocity.y = Math.min(0, rov.velocity.y);
    }

    // Limite inferior (fundo do mar)
    if (rov.position.y < -seabedDepth + 1) {
      rov.position.y = -seabedDepth + 1;
      rov.velocity.y = Math.max(0, rov.velocity.y);
    }
  }

  checkCollision(position, obstacles) {
    const rovRadius = 0.5; // Raio aproximado do ROV

    for (const obstacle of obstacles) {
      let collision = false;
      let normal = new THREE.Vector3();

      if (obstacle.type === "sphere") {
        const dist = position.distanceTo(obstacle.position);
        if (dist < rovRadius + obstacle.radius) {
          collision = true;
          normal.subVectors(position, obstacle.position).normalize();
        }
      } else if (obstacle.type === "box") {
        const box = new THREE.Box3().setFromCenterAndSize(
          obstacle.position,
          obstacle.size
        );
        const closestPoint = box.clampPoint(position, new THREE.Vector3());
        const dist = position.distanceTo(closestPoint);
        if (dist < rovRadius) {
          collision = true;
          normal.subVectors(position, closestPoint).normalize();
        }
      } else if (obstacle.type === "cylinder") {
        // Simplificação: tratar como esfera
        const dist2D = Math.sqrt(
          Math.pow(position.x - obstacle.position.x, 2) +
            Math.pow(position.z - obstacle.position.z, 2)
        );
        if (dist2D < rovRadius + obstacle.radius) {
          const yDist = Math.abs(position.y - obstacle.position.y);
          if (yDist < obstacle.height / 2) {
            collision = true;
            normal
              .set(
                position.x - obstacle.position.x,
                0,
                position.z - obstacle.position.z
              )
              .normalize();
          }
        }
      }

      if (collision) {
        return { collision: true, normal, obstacle };
      }
    }

    return { collision: false };
  }

  resolveCollision(rov, collisionResult) {
    if (!collisionResult.collision) return;

    const { normal, obstacle } = collisionResult;
    const rovRadius = 0.5;

    // Afastar o ROV do obstáculo
    const pushDistance = 0.1;
    rov.position.addScaledVector(normal, pushDistance);

    // Refletir velocidade
    const dot = rov.velocity.dot(normal);
    if (dot < 0) {
      rov.velocity.addScaledVector(normal, -2 * dot * 0.5); // 0.5 = elasticidade
    }

    // Aplicar dano
    const impactSpeed = Math.abs(dot);
    return impactSpeed;
  }
}

export default Physics;
