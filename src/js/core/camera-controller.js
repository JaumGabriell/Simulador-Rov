// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSEA - ROV SIMULATOR
// Controlador de Câmeras
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classe responsável por controlar todas as câmeras do simulador
 */
export class CameraController {
  constructor(simulator) {
    this.simulator = simulator;
  }

  updateCameras() {
    // Verificar se ROV existe
    if (!this.simulator.rov) {
      return;
    }
    
    const rovPos = this.simulator.rov.position;
    const rovRot = this.simulator.rov.rotation;
    const pitch = this.simulator.cameraPitch || 0;

    // Câmera principal segue o ROV
    const forward = new THREE.Vector3(
      Math.cos(rovRot.y),
      0,
      -Math.sin(rovRot.y),
    );
    const cameraOffset = forward.clone().multiplyScalar(0.0999); // Câmera 1.5m ATRÁS do ROV

    this.simulator.cameras.main.position.copy(rovPos).add(cameraOffset);
    this.simulator.cameras.main.rotation.set(pitch, rovRot.y - Math.PI / 2, 0);

    this.simulator.cameras.alt.position.copy(rovPos).add(cameraOffset);
    this.simulator.cameras.alt.position.y += 0.2;
    this.simulator.cameras.alt.rotation.set(0, rovRot.y - Math.PI / 2, -(pitch + 0.2));

    this.simulator.cameras.wide.position.copy(rovPos).add(cameraOffset);
    this.simulator.cameras.wide.rotation.set(0, rovRot.y - Math.PI / 2, -pitch);

    // ═══════════════════════════════════════════════════════════════
    // CÂMERA EXTERNA - CONTROLE ORBITAL
    // Permite rotacionar ao redor do ROV com mouse e zoom com scroll
    // Z = alternar entre rotação automática e manual
    // ═══════════════════════════════════════════════════════════════
    const orbit = this.simulator.orbitControl;

    let baseTheta;

    if (!orbit.manualRotation) {
      // MODO AUTO: câmera SEMPRE atrás do ROV (estilo terceira pessoa)
      baseTheta = -rovRot.y + Math.PI;
    } else {
      // MODO MANUAL: usa theta definido pelo mouse (ângulo fixo no mundo)
      baseTheta = orbit.theta;
    }

    // Calcular posição da câmera em coordenadas esféricas
    const x = orbit.distance * Math.sin(orbit.phi) * Math.cos(baseTheta);
    const y = orbit.distance * Math.cos(orbit.phi);
    const z = orbit.distance * Math.sin(orbit.phi) * Math.sin(baseTheta);

    // Posicionar câmera relativa ao ROV (sempre segue o ROV)
    this.simulator.cameras.external.position.set(
      rovPos.x + x,
      rovPos.y + y,
      rovPos.z + z,
    );

    // Sempre olhar para o ROV
    this.simulator.cameras.external.lookAt(rovPos);
  }
}
