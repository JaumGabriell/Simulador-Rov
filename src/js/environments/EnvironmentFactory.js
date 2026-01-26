// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSEA - ROV SIMULATOR
// Fábrica de Ambientes 3D
// ═══════════════════════════════════════════════════════════════════════════

export class EnvironmentFactory {
  constructor(simulator) {
    this.simulator = simulator;
    this.scene = simulator.scene;
  }

  create() {
    // Criar base para todos os cenários
    this.createSeabed();
    this.createParticles();

    // Criar ambiente específico
    const envType =
      this.simulator.scenarioConfig.environmentType || "open_water";

    switch (envType) {
      case "training":
        this.createTrainingCourse();
        break;
      case "tank":
        this.createTankEnvironment();
        break;
      case "jacket":
        this.createJacketStructure();
        break;
      case "manifold":
        this.createManifoldEnvironment();
        break;
      case "pipeline":
        this.createPipelineEnvironment();
        break;
      case "hull":
        this.createHullEnvironment();
        break;
      case "wellhead":
        this.createWellheadEnvironment();
        break;
      case "umbilical":
        this.createUmbilicalEnvironment();
        break;
      case "subsea_equipment":
        this.createSubseaEquipment();
        break;
      case "debris":
        this.createDebrisField();
        break;
      case "open_water":
      default:
        this.createOpenWaterEnvironment();
        break;
    }

    // Criar marcadores de objetivos
    this.createObjectiveMarkers();
  }

  createSeabed() {
    const seabedDepth = this.simulator.environment.seabedDepth;

    // Geometria do fundo
    const seabedGeometry = new THREE.PlaneGeometry(300, 300, 80, 80);
    const seabedMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a3530,
      roughness: 0.95,
      metalness: 0.05,
    });

    // Adicionar variação de terreno
    const positions = seabedGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i);
      positions.setZ(i, z + Math.random() * 2 - 1);
    }
    seabedGeometry.computeVertexNormals();

    const seabed = new THREE.Mesh(seabedGeometry, seabedMaterial);
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.y = -seabedDepth;
    seabed.receiveShadow = true;
    this.scene.add(seabed);

    // Adicionar rochas
    this.createRocks(seabedDepth);

    // Colisão com o fundo
    this.simulator.obstacles.push({
      type: "box",
      mesh: seabed,
      position: new THREE.Vector3(0, -seabedDepth - 0.5, 0),
      size: new THREE.Vector3(300, 1, 300),
    });

    // Colisão com a superfície
    this.simulator.obstacles.push({
      type: "box",
      mesh: null,
      position: new THREE.Vector3(0, 0, 0),
      size: new THREE.Vector3(300, 1, 300),
    });
  }

  createRocks(seabedDepth) {
    for (let i = 0; i < 20; i++) {
      const rockSize = 1 + Math.random() * 2;
      let rockX, rockZ;
      let validPosition = false;
      let attempts = 0;

      while (!validPosition && attempts < 20) {
        rockX = Math.random() * 200 - 100;
        rockZ = Math.random() * 200 - 100;
        validPosition = this.isPositionSafe(
          rockX,
          -seabedDepth,
          rockZ,
          12 + rockSize
        );
        attempts++;
      }

      if (!validPosition) continue;

      const rockGeometry = new THREE.DodecahedronGeometry(rockSize, 0);
      const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4540,
        roughness: 1,
      });
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      rock.position.set(rockX, -seabedDepth + Math.random() * 2, rockZ);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.scale.y = 0.5;
      this.scene.add(rock);

      this.simulator.obstacles.push({
        type: "sphere",
        mesh: rock,
        position: rock.position.clone(),
        radius: rockSize * 0.7,
      });
    }
  }

  isPositionSafe(x, y, z, minDistance = 10) {
    const pos = new THREE.Vector3(x, y, z);
    const config = this.simulator.scenarioConfig;

    // Verificar distância do spawn
    const spawnPos = new THREE.Vector3(
      config.startX,
      config.startY,
      config.startZ
    );
    if (pos.distanceTo(spawnPos) < minDistance + 5) return false;

    // Verificar distância dos checkpoints
    for (const obj of this.simulator.objectives) {
      if (obj.target) {
        const objPos = new THREE.Vector3(
          obj.target.x,
          obj.target.y,
          obj.target.z
        );
        if (pos.distanceTo(objPos) < minDistance + (obj.radius || 3))
          return false;
      }
    }

    return true;
  }

  createParticles() {
    // Partículas flutuantes
    const particleCount = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const seabedDepth = this.simulator.environment.seabedDepth;

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = Math.random() * 150 - 75;
      positions[i * 3 + 1] = -Math.random() * seabedDepth;
      positions[i * 3 + 2] = Math.random() * 150 - 75;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x88aacc,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
    });

    this.simulator.particles = new THREE.Points(geometry, material);
    this.scene.add(this.simulator.particles);

    // Bolhas
    this.createBubbles();
  }

  createBubbles() {
    this.simulator.bubbles = [];
    const seabedDepth = this.simulator.environment.seabedDepth;

    for (let i = 0; i < 30; i++) {
      const geometry = new THREE.SphereGeometry(
        0.05 + Math.random() * 0.1,
        8,
        8
      );
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
      });
      const bubble = new THREE.Mesh(geometry, material);
      bubble.position.set(
        Math.random() * 100 - 50,
        -seabedDepth + Math.random() * seabedDepth,
        Math.random() * 100 - 50
      );
      bubble.userData.speed = 0.02 + Math.random() * 0.03;
      this.scene.add(bubble);
      this.simulator.bubbles.push(bubble);
    }
  }

  createTrainingCourse() {
    const startY = this.simulator.scenarioConfig.startY || -10;
    const centerY = startY;

    // Materiais
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b0000,
      metalness: 0.4,
      roughness: 0.7,
      emissive: 0x220000,
      emissiveIntensity: 0.1,
    });

    const obstacleMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3c32,
      metalness: 0.6,
      roughness: 0.8,
      emissive: 0x1a0a00,
      emissiveIntensity: 0.1,
    });

    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      metalness: 0.3,
      roughness: 0.7,
      emissive: 0x00ff00,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.8,
    });

    // Dimensões da arena
    const arenaSize = 60;
    const wallHeight = 15;
    const wallThickness = 1;

    // Paredes
    this.createWall(
      0,
      centerY,
      -arenaSize / 2,
      arenaSize,
      wallHeight,
      wallThickness,
      wallMaterial
    );
    this.createWall(
      0,
      centerY,
      arenaSize / 2,
      arenaSize,
      wallHeight,
      wallThickness,
      wallMaterial
    );
    this.createWall(
      -arenaSize / 2,
      centerY,
      0,
      wallThickness,
      wallHeight,
      arenaSize,
      wallMaterial
    );
    this.createWall(
      arenaSize / 2,
      centerY,
      0,
      wallThickness,
      wallHeight,
      arenaSize,
      wallMaterial
    );

    // Piso e teto
    this.createFloor(
      0,
      centerY - wallHeight / 2,
      0,
      arenaSize,
      arenaSize,
      obstacleMaterial
    );
    this.createFloor(
      0,
      centerY + wallHeight / 2,
      0,
      arenaSize,
      arenaSize,
      obstacleMaterial
    );

    // Obstáculos
    this.createObstacles(centerY, obstacleMaterial);

    // Anéis de passagem
    this.createRings(centerY, ringMaterial);

    // Iluminação da arena
    this.createArenaLighting(centerY, wallHeight);
  }

  createWall(x, y, z, width, height, depth, material) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set(x, y, z);
    this.scene.add(wall);

    this.simulator.obstacles.push({
      type: "box",
      mesh: wall,
      position: wall.position.clone(),
      size: new THREE.Vector3(width, height, depth),
    });
  }

  createFloor(x, y, z, width, depth, material) {
    const geometry = new THREE.BoxGeometry(width, 0.5, depth);
    const floor = new THREE.Mesh(geometry, material);
    floor.position.set(x, y, z);
    this.scene.add(floor);

    this.simulator.obstacles.push({
      type: "box",
      mesh: floor,
      position: floor.position.clone(),
      size: new THREE.Vector3(width, 0.5, depth),
    });
  }

  createObstacles(centerY, material) {
    // Caixas de obstáculo
    const obstaclePositions = [
      { x: 10, z: 10, w: 3, h: 4, d: 3 },
      { x: -10, z: -10, w: 4, h: 3, d: 4 },
      { x: 15, z: -8, w: 2, h: 5, d: 2 },
      { x: -12, z: 12, w: 3, h: 3, d: 3 },
    ];

    obstaclePositions.forEach((pos) => {
      const geometry = new THREE.BoxGeometry(pos.w, pos.h, pos.d);
      const obstacle = new THREE.Mesh(geometry, material);
      obstacle.position.set(pos.x, centerY, pos.z);
      this.scene.add(obstacle);

      this.simulator.obstacles.push({
        type: "box",
        mesh: obstacle,
        position: obstacle.position.clone(),
        size: new THREE.Vector3(pos.w, pos.h, pos.d),
      });
    });
  }

  createRings(centerY, material) {
    const ringPositions = [
      { x: 22, y: centerY, z: 0 },
      { x: -22, y: centerY, z: 0 },
      { x: 0, y: centerY - 5, z: 0 },
      { x: 0, y: centerY + 5, z: 0 },
      { x: 0, y: centerY, z: 22 },
      { x: 0, y: centerY, z: -22 },
    ];

    ringPositions.forEach((pos, i) => {
      const geometry = new THREE.TorusGeometry(3, 0.3, 16, 32);
      const ring = new THREE.Mesh(geometry, material);
      ring.position.set(pos.x, pos.y, pos.z);

      // Rotação baseada na posição
      if (i < 2) ring.rotation.y = Math.PI / 2;
      else if (i < 4) ring.rotation.x = Math.PI / 2;

      this.scene.add(ring);
    });
  }

  createArenaLighting(centerY, wallHeight) {
    // Luzes nos cantos
    const cornerPositions = [
      { x: 25, z: 25 },
      { x: -25, z: 25 },
      { x: 25, z: -25 },
      { x: -25, z: -25 },
    ];

    cornerPositions.forEach((pos) => {
      const light = new THREE.PointLight(0x442211, 0.01, 10);
      light.position.set(pos.x, centerY, pos.z);
      this.scene.add(light);
    });

    // Luz central
    const centerLight = new THREE.PointLight(0x331111, 0.01, 10);
    centerLight.position.set(0, centerY, 0);
    this.scene.add(centerLight);
  }

  createObjectiveMarkers() {
    this.simulator.objectiveMarkers = [];

    this.simulator.objectives.forEach((obj, index) => {
      if (obj.target && obj.type === "distance") {
        const markerGroup = new THREE.Group();

        // Anel externo
        const ringGeometry = new THREE.RingGeometry(
          obj.radius - 1,
          obj.radius,
          32
        );
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ff88,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.3,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        markerGroup.add(ring);

        // Coluna de luz
        const beamGeometry = new THREE.CylinderGeometry(0.5, 2, 30, 8, 1, true);
        const beamMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ff88,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide,
        });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);
        beam.position.y = 15;
        markerGroup.add(beam);

        // Esfera central
        const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ff88,
          transparent: true,
          opacity: 0.8,
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        markerGroup.add(sphere);

        markerGroup.position.set(obj.target.x, obj.target.y, obj.target.z);
        markerGroup.userData = { objectiveIndex: index, objective: obj };

        this.scene.add(markerGroup);
        this.simulator.objectiveMarkers.push(markerGroup);
      }
    });
  }

  // Métodos para outros tipos de ambiente (simplificados)
  createTankEnvironment() {
    // Implementação do tanque de lastro
  }

  createJacketStructure() {
    // Implementação da estrutura de jaqueta
  }

  createManifoldEnvironment() {
    // Implementação do manifold
  }

  createPipelineEnvironment() {
    // Implementação do pipeline
  }

  createHullEnvironment() {
    // Implementação do casco
  }

  createWellheadEnvironment() {
    // Implementação do wellhead
  }

  createUmbilicalEnvironment() {
    // Implementação do umbilical
  }

  createSubseaEquipment() {
    // Implementação de equipamentos submarinos
  }

  createDebrisField() {
    // Implementação do campo de detritos
  }

  createOpenWaterEnvironment() {
    // Ambiente de água aberta (padrão)
  }
}

export default EnvironmentFactory;
