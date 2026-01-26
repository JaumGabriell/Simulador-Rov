// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSEA - ROV PROFESSIONAL TRAINING SIMULATOR
// Classe Principal do Simulador
// ═══════════════════════════════════════════════════════════════════════════

import { SCENARIO_CONFIGS } from "../scenarios/index.js";
import { Physics } from "./physics.js";
import { Controls } from "./controls.js";
import { HUD } from "./hud.js";
import { EnvironmentFactory } from "../environments/EnvironmentFactory.js";
import { ModelLoader } from "../loaders/model-loader.js";
import { GamepadController } from "./GamepadController.js";
import { CollisionSystem } from "./CollisionSystem.js";
import { CameraController } from "./camera-controller.js";
import { UpdateHUD } from "./update-HUD.js";
// GLTFLoader carregado via CDN - usa THREE.GLTFLoader

export class ROVSimulator {
  constructor() {
    // Ler cenário da URL
    const urlParams = new URLSearchParams(window.location.search);
    this.scenarioId = urlParams.get("scenario") || "fpso_inspection";
    this.scenarioConfig =
      SCENARIO_CONFIGS[this.scenarioId] || SCENARIO_CONFIGS.fpso_inspection;
    this.isEmbedded = urlParams.get("embedded") === "true";

    // State
    this.isRunning = false;
    this.isPaused = false;
    this.isArmed = true;
    this.lightsOn = true;
    this.lightPower = 1.0;
    this.sessionTime = 0;
    this.score = 0;
    this.totalPossibleScore = 0;

    // Objectives - clonar para não modificar o original
    this.objectives = JSON.parse(
      JSON.stringify(this.scenarioConfig.objectives || []),
    );
    this.objectives.forEach((obj) => {
      obj.completed = false;
      this.totalPossibleScore += obj.points;
    });

    // Tracking para objetivos
    this.distanceTraveled = 0;
    this.lastPosition = null;
    this.timeAtObjective = 0;

    // Multiplicador de velocidade (25% a 1000%)
    this.speedMultiplier = 1.0;

    // Sistema de Dano
    this.damage = 0;
    this.maxDamage = 100;
    this.lastCollisionTime = 0;
    this.collisionCooldown = 0.5;
    this.obstacles = [];
    this.missionFailed = false;

    // Sistema de Coleta de ROVs
    this.collectableROVs = [];
    this.attachedROV = null;
    this.rovsCollected = 0;
    this.dropZone = { x: 0, y: -5, z: 0, radius: 8 };

    // Sistema de Eventos Aleatórios
    this.randomEvents = {
      active: false,
      type: null,
      timer: 0,
      nextEventTime: 60 + Math.random() * 120,
      maintenanceZone: { x: 0, y: -3, z: 0, radius: 10 },
    };

    this.eventTypes = [
      {
        id: "overheat",
        name: "🌡️ SUPERAQUECIMENTO",
        desc: "Raspberry Pi esquentando! Suba para resfriar.",
        urgency: 30,
      },
      {
        id: "corrosion",
        name: "⚠️ CORROSÃO DETECTADA",
        desc: "Sensor de corrosão ativado! Manutenção necessária.",
        urgency: 45,
      },
      {
        id: "leak",
        name: "💧 VAZAMENTO",
        desc: "Possível infiltração! Suba para verificação.",
        urgency: 25,
      },
      {
        id: "thruster",
        name: "🔧 THRUSTER IRREGULAR",
        desc: "Vibração anormal no propulsor. Manutenção requerida.",
        urgency: 40,
      },
    ];

    // ROV State - usar posição inicial do cenário
    this.rov = {
      position: new THREE.Vector3(
        this.scenarioConfig.startX || 0,
        this.scenarioConfig.startY || -30,
        this.scenarioConfig.startZ || 0,
      ),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(0, 0, 0, "YXZ"),
      angularVelocity: new THREE.Vector3(),
      thrusters: new Array(8).fill(0),
    };

    // Control input
    this.input = {
      surge: 0,
      sway: 0,
      heave: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
    };

    // Key states
    this.keys = {};
    this.cameraPitch = 0;

    // Environment - usar configurações do cenário
    this.environment = {
      seabedDepth: this.scenarioConfig.seabedDepth,
      visibility: this.scenarioConfig.visibility,
      currentX: this.scenarioConfig.currentX,
      currentY: this.scenarioConfig.currentY,
    };

    // Three.js
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.rovModel = null;
    this.lights = [];

    // Cameras
    this.cameras = {
      main: null,
      alt: null,
      wide: null,
      external: null,
    };
    this.activeCamera = "main";

    // Controle orbital para câmera externa (terceira pessoa)
    this.orbitControl = {
      isDragging: false,
      theta: 0, // Ângulo horizontal (ao redor do ROV)
      phi: Math.PI / 4, // Ângulo vertical (elevação)
      distance: 8, // Distância do ROV
      minDistance: 2,
      maxDistance: 30,
      lastMouseX: 0,
      lastMouseY: 0,
      sensitivity: 0.005,
      // Modo de rotação:
      // false = câmera gira automaticamente com o ROV (padrão)
      // true = câmera mantém ângulo fixo, só muda com mouse
      manualRotation: false,
    };

    // Animation
    this.clock = new THREE.Clock();
    this.lastTime = 0;

    // Subsystems
    this.physics = null;
    this.controls = null;
    this.hud = null;
    this.environmentFactory = null;
    this.modelLoader = null;
    this.collisionSystem = null;
    this.cameraController = null;
    this.hudController = null;

    // Initialize
    this.init();
  }

  async init() {
    this.updateLoadingStatus("Connecting to server...", 5);
    await this.sleep(100);

    // Load scenarios from API
    await this.loadScenariosFromAPI();

    this.updateLoadingStatus("Initializing renderer...", 15);
    await this.sleep(100);

    this.initRenderer();

    this.updateLoadingStatus("Loading scene...", 35);
    await this.sleep(100);

    this.initScene();

    await this.loadScenarioModel().catch(() => {});

    this.updateLoadingStatus("Creating ROV model...", 55);
    await this.sleep(100);

    this.createROVModel();

    // Inicializar sistema de colisão APÓS criar o ROV e carregar o modelo
    this.initCollisionSystem();

    this.updateLoadingStatus("Setting up environment...", 75);
    await this.sleep(100);

    this.createEnvironment();

    this.updateLoadingStatus("Initializing controls...", 90);
    await this.sleep(100);

    this.initControls();
    this.initGamepad();
    this.initHUD();

    this.updateLoadingStatus("Ready!", 100);
    await this.sleep(500);

    // Hide loading screen
    document.getElementById("loading-screen").classList.add("hidden");

    // Start simulation
    this.start();
  }

  async loadScenariosFromAPI() {
    try {
      const response = await fetch("/api/v1/scenarios");
      const data = await response.json();

      if (data.success && data.data) {
        this.availableScenarios = data.data;
        console.log(
          `Loaded ${this.availableScenarios.length} scenarios from server`,
        );
        this.updateScenarioList();
      }
    } catch (error) {
      console.warn("Could not load scenarios from API, using defaults");
      this.availableScenarios = this.getDefaultScenarios();
    }
  }

  getDefaultScenarios() {
    return Object.entries(SCENARIO_CONFIGS).map(([id, config]) => ({
      id,
      name: config.name,
      difficulty:
        config.difficulty === "easy"
          ? 1
          : config.difficulty === "medium"
            ? 2
            : config.difficulty === "hard"
              ? 3
              : config.difficulty === "expert"
                ? 4
                : 5,
    }));
  }

  updateScenarioList() {
    const selector = document.getElementById("scenario-selector");
    if (!selector) return;

    selector.innerHTML = this.availableScenarios
      .map(
        (s) =>
          `<option value="${s.id}">${s.name} (★${"★".repeat(
            s.difficulty - 1,
          )})</option>`,
      )
      .join("");
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  updateLoadingStatus(status, progress) {
    const statusEl = document.getElementById("loading-status");
    const barEl = document.getElementById("loading-bar");
    if (statusEl) statusEl.textContent = status;
    if (barEl) barEl.style.width = progress + "%";
  }

  initRenderer() {
    const canvas = document.getElementById("viewport");
    const container = document.getElementById("viewport-container");

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });

    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x001520);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Handle resize
    window.addEventListener("resize", () => this.onResize());
  }

  initScene() {
    this.scene = new THREE.Scene();

    // Névoa baseada na visibilidade do cenário
    const fogDensity = 1 / (this.environment.visibility * 8);
    this.scene.fog = new THREE.FogExp2(0x002030, fogDensity);
    this.scene.background = new THREE.Color(0x001520);

    // Main camera (ROV front)
    this.cameras.main = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 300);
    this.cameras.main.rotation.order = "YXZ";
    this.cameras.main.position.set(0.8, 0, 0);
    this.cameras.main.rotation.set(0, -Math.PI / 2, 0);

    // Alt camera
    this.cameras.alt = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 300);
    this.cameras.alt.position.set(0.8, 0.2, 0);
    this.cameras.alt.rotation.set(0.2, -Math.PI / 2, 0);

    // Wide camera
    this.cameras.wide = new THREE.PerspectiveCamera(100, 16 / 9, 0.1, 300);
    this.cameras.wide.position.set(0.8, 0, 0);
    this.cameras.wide.rotation.set(0, -Math.PI / 2, 0);

    // External camera
    this.cameras.external = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
    this.cameras.external.position.set(-8, 4, 0);

    this.camera = this.cameras.main;

    // Reset camera settings after cameras are created
    this.resetCameraSettings();

    // Iluminação varia por cenário
    if (this.scenarioId === "training_arena") {
      const ambient = new THREE.AmbientLight(0x111111, 0.1);
      this.scene.add(ambient);
    } else {
      const ambient = new THREE.AmbientLight(0x4488aa, 1.5);
      this.scene.add(ambient);

      const sunLight = new THREE.DirectionalLight(0x88bbdd, 0.8);
      sunLight.position.set(0, 100, 0);
      this.scene.add(sunLight);

      const hemi = new THREE.HemisphereLight(0x4499cc, 0x224466, 1.0);
      this.scene.add(hemi);
    }
  }

  createROVModel() {
    // Criar modelo fallback primeiro (caixa)
    this.createFallbackROV();

    // Modelo atual selecionado (padrão: rov_pi)
    this.currentROVModel = "rov_pi";

    // Definir hitboxes específicas para cada modelo ROV (proporcional ao rovScaleMultiplier = 0.5)
    this.rovHitboxes = {
      rov_pi: {
        // ROV Pi - mais compacto
        width: 0.5,
        height: 0.4,
        depth: 0.6,
        radius: 0.35,
        offsetY: 0,
      },
      rov_omega: {
        // ROV Omega - maior
        width: 1.2,
        height: 0.8,
        depth: 1.6,
        radius: 1.0,
        offsetY: 0,
      },
    };

    // Tentar carregar modelo STL real
    this.loadRealROVModel(this.currentROVModel);

    // Configurar seletores de ROV
    this.initROVSelector();
  }

  // Obter hitbox do ROV atual
  getROVHitbox() {
    return this.rovHitboxes[this.currentROVModel] || this.rovHitboxes.rov_pi;
  }

  // Obter raio de colisão do ROV atual
  getROVCollisionRadius() {
    return this.getROVHitbox().radius;
  }

  initROVSelector() {
    const rovOptions = document.querySelectorAll(".rov-option");

    rovOptions.forEach((option) => {
      option.addEventListener("click", () => {
        // Remover seleção anterior
        rovOptions.forEach((opt) => opt.classList.remove("selected"));

        // Adicionar seleção ao clicado
        option.classList.add("selected");

        // Obter nome do modelo
        const modelName = option.dataset.model;

        // Trocar modelo se for diferente
        if (modelName !== this.currentROVModel) {
          this.currentROVModel = modelName;
          this.loadRealROVModel(modelName);
          this.addEvent("info", `Modelo alterado: ${modelName.toUpperCase()}`);
        }
      });
    });
  }

  async loadRealROVModel(modelName = "rov_omega") {
    try {
      // Carregar STLLoader
      const STLLoader = await this.getSTLLoader();
      if (!STLLoader) {
        console.warn("STLLoader not available");
        return;
      }

      const loader = new STLLoader();
      const modelPath = `/models/${modelName}.stl`;
      console.log(`Loading ROV model: ${modelName}...`);

      loader.load(
        modelPath,
        (geometry) => {
          console.log("ROV STL model loaded successfully!");

          // Centralizar geometria
          geometry.center();
          geometry.computeBoundingBox();

          // Calcular escala para ~1 metro (ajuste rovScaleMultiplier para mudar tamanho)
          const rovScaleMultiplier = 0.4; // 0.5 = metade do tamanho, 1.0 = normal, 2.0 = dobro
          const bbox = geometry.boundingBox;
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = (1.0 / maxDim) * rovScaleMultiplier;

          // Material do ROV
          const material = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            metalness: 0.6,
            roughness: 0.4,
          });

          const rovMesh = new THREE.Mesh(geometry, material);
          rovMesh.scale.set(scale, scale, scale);
          rovMesh.castShadow = true;
          rovMesh.receiveShadow = true;

          // Rotação para orientação correta
          rovMesh.rotation.x = -Math.PI / 2;
          rovMesh.rotation.z = Math.PI / 2;

          // Limpar modelos anteriores (manter apenas luzes)
          const childrenToRemove = [];
          this.rovModel.children.forEach((child) => {
            if (child.isMesh || child.isLineSegments) {
              childrenToRemove.push(child);
            }
          });
          childrenToRemove.forEach((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            this.rovModel.remove(child);
          });

          // Esconder geometria do fallback (se existir)
          if (this.rovModel.geometry && this.rovModel.geometry.dispose) {
            this.rovModel.geometry.dispose();
            this.rovModel.geometry = new THREE.BufferGeometry();
          }
          if (this.rovModel.material) {
            this.rovModel.material.visible = false;
          }

          // Marcar o mesh do modelo para identificação
          rovMesh.name = "rov-stl-model";

          // Adicionar modelo real
          this.rovModel.add(rovMesh);

          this.addEvent("success", `${modelName.toUpperCase()} carregado!`);
        },
        (progress) => {
          if (progress.lengthComputable) {
            const percent = ((progress.loaded / progress.total) * 100).toFixed(
              0,
            );
            console.log(`Loading ROV model: ${percent}%`);
          }
        },
        (error) => {
          console.warn("Could not load ROV STL model:", error.message);
        },
      );
    } catch (error) {
      console.warn("Error loading ROV model:", error.message);
    }
  }

  async getSTLLoader() {
    if (THREE.STLLoader) {
      return THREE.STLLoader;
    }

    // Criar STLLoader inline
    return new Promise((resolve) => {
      class STLLoader extends THREE.Loader {
        constructor(manager) {
          super(manager);
        }

        load(url, onLoad, onProgress, onError) {
          const loader = new THREE.FileLoader(this.manager);
          loader.setPath(this.path);
          loader.setResponseType("arraybuffer");
          loader.load(
            url,
            (buffer) => {
              try {
                onLoad(this.parse(buffer));
              } catch (e) {
                if (onError) onError(e);
                else console.error(e);
              }
            },
            onProgress,
            onError,
          );
        }

        parse(data) {
          const reader = new DataView(data);
          const faces = reader.getUint32(80, true);

          const geometry = new THREE.BufferGeometry();
          const vertices = new Float32Array(faces * 3 * 3);
          const normals = new Float32Array(faces * 3 * 3);

          for (let face = 0; face < faces; face++) {
            const start = 84 + face * 50;
            const normalX = reader.getFloat32(start, true);
            const normalY = reader.getFloat32(start + 4, true);
            const normalZ = reader.getFloat32(start + 8, true);

            for (let i = 1; i <= 3; i++) {
              const vertexstart = start + i * 12;
              const idx = face * 3 * 3 + (i - 1) * 3;

              vertices[idx] = reader.getFloat32(vertexstart, true);
              vertices[idx + 1] = reader.getFloat32(vertexstart + 4, true);
              vertices[idx + 2] = reader.getFloat32(vertexstart + 8, true);

              normals[idx] = normalX;
              normals[idx + 1] = normalY;
              normals[idx + 2] = normalZ;
            }
          }

          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(vertices, 3),
          );
          geometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(normals, 3),
          );

          return geometry;
        }
      }

      THREE.STLLoader = STLLoader;
      resolve(STLLoader);
    });
  }

  createFallbackROV() {
    // ROV body (fallback - caixa simples, escala 0.5x)
    const bodyGeometry = new THREE.BoxGeometry(0.35, 0.25, 0.22);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      metalness: 0.6,
      roughness: 0.4,
    });
    this.rovModel = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.rovModel.castShadow = true;
    this.rovModel.position.copy(this.rov.position);
    this.scene.add(this.rovModel);

    // Frame
    const frameGeometry = new THREE.BoxGeometry(0.38, 0.28, 0.25);
    const edges = new THREE.EdgesGeometry(frameGeometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x666666 }),
    );
    this.rovModel.add(line);

    // Lights
    for (let i = 0; i < 2; i++) {
      const spotlight = new THREE.SpotLight(
        0xffffee,
        5,
        80,
        Math.PI / 3,
        0.3,
        1,
      );
      spotlight.position.set(0.25, i === 0 ? 0.08 : -0.08, 0);
      spotlight.target.position.set(20, 0, 0);
      spotlight.castShadow = true;
      this.rovModel.add(spotlight);
      this.rovModel.add(spotlight.target);
      this.lights.push(spotlight);
    }

    const rovAmbient = new THREE.PointLight(0xffffee, 1, 30);
    rovAmbient.position.set(0.3, 0, 0);
    this.rovModel.add(rovAmbient);
    this.lights.push(rovAmbient);

    this.scene.add(this.cameras.main);
    this.scene.add(this.cameras.alt);
    this.scene.add(this.cameras.wide);
    this.scene.add(this.cameras.external);
  }

  createEnvironment() {
    // Criar fundo do mar
    this.createSeabed();

    // Criar partículas flutuantes
    this.createParticles();

    // Criar marcadores de objetivos
    this.createObjectiveMarkers();

    // Criar túneis do circuito (apenas para training_arena)
    if (this.scenarioId === "training_arena") {
      this.createObstacleTunnels();
    }
  }

  async loadScenarioModel() {
    const modelPath = this.scenarioConfig.modelPath;
    if (!modelPath) {
      console.warn(
        "Caminho do modelo do cenário não encontrado para:",
        this.scenarioId,
      );
      return;
    }

    this.updateLoadingStatus("Carregando modelo do cenário...", 45);

    return new Promise((resolve, reject) => {
      const loader = new THREE.GLTFLoader();

      loader.load(
        modelPath,
        (gltf) => {
          this.scenarioModel = gltf.scene;
          this.scenarioModel.name = "scenario-model";

          // Aplicar posição do cenário
          const pos = this.scenarioConfig.modelPosition || { x: 0, y: 0, z: 0 };
          this.scenarioModel.position.set(pos.x, pos.y, pos.z);

          // Aplicar escala do cenário
          const scale = this.scenarioConfig.modelScale || 1.0;
          this.scenarioModel.scale.set(scale, scale, scale);

          this.scene.add(this.scenarioModel);

          console.log(
            `Scenario model loaded: ${modelPath} at position (${pos.x}, ${pos.y}, ${pos.z})`,
          );
          resolve(gltf);
        },
        (xhr) => {
          const progress = (xhr.loaded / xhr.total) * 100;
          this.updateLoadingStatus(
            `carregando modelo do cenário... ${progress.toFixed(0)}%`,
            45 + progress * 0.1,
          );
        },
        (err) => {
          console.error(`Falhou em carregar o cenário: ${modelPath}`, err);
          reject(err);
        },
      );
    });
  }

  createSeabed() {
    const seabedDepth = this.environment.seabedDepth;

    // Geometria do fundo
    const seabedGeometry = new THREE.PlaneGeometry(300, 300, 50, 50);
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

    // Adicionar algumas rochas
    for (let i = 0; i < 15; i++) {
      const rockSize = 1 + Math.random() * 3;
      const rockGeometry = new THREE.DodecahedronGeometry(rockSize, 0);
      const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4540,
        roughness: 1,
      });
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      rock.position.set(
        Math.random() * 200 - 100,
        -seabedDepth + Math.random() * 2,
        Math.random() * 200 - 100,
      );
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.scale.y = 0.5;
      this.scene.add(rock);
    }
  }

  createParticles() {
    const particleCount = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const seabedDepth = this.environment.seabedDepth;

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

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  // Inicializar sistema de colisão por raycasting
  initCollisionSystem() {
    console.log("Iniciando sistema de colisão...");
    console.log("ROV Model:", this.rovModel ? "OK" : "FALTANDO");
    console.log("Scenario Model:", this.scenarioModel ? "OK" : "FALTANDO");

    if (!this.rovModel || !this.scenarioModel) {
      console.warn("ROV ou cenário não carregado, colisão desabilitada");
      // Mesmo sem cenário, inicializar os controladores!
      console.log("Inicializando controladores mesmo sem cenário...");
      this.cameraController = new CameraController(this);
      console.log("CameraController inicializado");
      this.hudController = new UpdateHUD(this);
      console.log("HUD Controller inicializado");
      return;
    }

    try {
      this.collisionSystem = new CollisionSystem(this.scene, this.rovModel);
      this.collisionSystem.addCollidableObject(this.scenarioModel);
      console.log("Sistema de colisão inicializado com raycasting");

      // Ativar debug por padrão para teste
      this.collisionSystem.showDebug = true;
      this.collisionSystem.createDebugHelpers();
      console.log("Debug de colisão ATIVADO - raios visíveis");
    } catch (error) {
      console.error("Erro ao inicializar sistema de colisão:", error);
    }
    
    // Inicializar controladores (independente do sistema de colisão)
    this.cameraController = new CameraController(this);
    console.log("CameraController inicializado");
    
    this.hudController = new UpdateHUD(this);
    console.log("HUD Controller inicializado");
  }

  // [REMOVIDO] Cria cenario de fisica com Ammo.js
  createScenarioPhysics_OLD() {
    if (!this.scenarioModel) {
      console.warn("Modelo do cenário não carregado, pulando física");
      return;
    }

    try {
      const triangleMesh = new Ammo.btTriangleMesh(); // representa uma malha triangular
      let triangleCount = 0;

      // percorre todos os meshes do modelo 3D para extrair vertices e criar colisão precisa
      this.scenarioModel.traverse((child) => {
        if (child.isMesh) {
          const geometry = child.geometry;
          const pos = geometry.attributes.position;
          if (!pos) return;

          // Aplicar transformações do mundo ao mesh
          child.updateMatrixWorld(true);
          const matrix = child.matrixWorld;

          const positions = pos.array;
          const indices = geometry.index ? geometry.index.array : null;

          // Função para pegar vértice transformado
          const getVertex = (index) => {
            const x = positions[index * 3];
            const y = positions[index * 3 + 1];
            const z = positions[index * 3 + 2];
            const vec = new THREE.Vector3(x, y, z);
            vec.applyMatrix4(matrix);
            return new Ammo.btVector3(vec.x, vec.y, vec.z);
          };

          if (indices) {
            // Geometria indexada - usa índices para formar triângulos
            for (let i = 0; i < indices.length; i += 3) {
              const v0 = getVertex(indices[i]);
              const v1 = getVertex(indices[i + 1]);
              const v2 = getVertex(indices[i + 2]);
              triangleMesh.addTriangle(v0, v1, v2);
              triangleCount++;
            }
          } else {
            // Geometria não-indexada - cada 3 vértices = 1 triângulo
            for (let i = 0; i < positions.length / 3; i += 3) {
              const v0 = getVertex(i);
              const v1 = getVertex(i + 1);
              const v2 = getVertex(i + 2);
              triangleMesh.addTriangle(v0, v1, v2);
              triangleCount++;
            }
          }
        }
      });

      if (triangleCount === 0) {
        console.warn("Nenhum triângulo encontrado no modelo");
        return;
      }

      console.log(`Física do cenário: ${triangleCount} triângulos`);

      // Limite de triângulos para evitar OOM (Out of Memory)
      const MAX_TRIANGLES = 50000;
      let shape;

      if (triangleCount > MAX_TRIANGLES) {
        console.warn(
          `Modelo muito grande (${triangleCount} triângulos), usando bounding box simplificado`,
        );

        // Calcular bounding box do modelo
        const box = new THREE.Box3().setFromObject(this.scenarioModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Criar forma de caixa simplificada
        shape = new Ammo.btBoxShape(
          new Ammo.btVector3(size.x / 2, size.y / 2, size.z / 2),
        );
      } else {
        shape = new Ammo.btBvhTriangleMeshShape(triangleMesh, true);
      }
      const transform = new Ammo.btTransform();
      transform.setIdentity();

      const motionState = new Ammo.btDefaultMotionState(transform);
      const localInertia = new Ammo.btVector3(0, 0, 0);

      const rbInfo = new Ammo.btRigidBodyConstructionInfo(
        0,
        motionState,
        shape,
        localInertia,
      );
      const body = new Ammo.btRigidBody(rbInfo);

      this.physicsWorld.addRigidBody(body);
      console.log("Física do cenário criada com sucesso!");
    } catch (error) {
      console.error("Erro ao criar física do cenário:", error);
    }
  }

  createObjectiveMarkers() {
    this.objectiveMarkers = [];

    this.objectives.forEach((obj, index) => {
      if (obj.target) {
        const markerGroup = new THREE.Group();

        // Esfera central
        const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ff88,
          transparent: true,
          opacity: 0.8,
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        markerGroup.add(sphere);

        // Anel
        const ringGeometry = new THREE.RingGeometry(
          obj.radius - 1 || 2,
          obj.radius || 3,
          32,
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

        markerGroup.position.set(obj.target.x, obj.target.y, obj.target.z);
        markerGroup.userData = { objectiveIndex: index, objective: obj };

        this.scene.add(markerGroup);
        this.objectiveMarkers.push(markerGroup);
      }
    });
  }

  createObstacleTunnels() {
    // Pontos de controle do circuito - ajustados para evitar sobreposição
    // O final entra pelo sudoeste, alinhado com a saída que vai para nordeste
    const checkpoints = [
      new THREE.Vector3(0, -10, 0), // 1. Centro (início)
      new THREE.Vector3(80, -15, 40), // 2. Nordeste
      new THREE.Vector3(40, -20, 90), // 3. Norte
      new THREE.Vector3(-40, -8, 70), // 4. Noroeste (subindo)
      new THREE.Vector3(-85, -35, 0), // 5. Oeste (FUNDO - passa por baixo)
      new THREE.Vector3(-40, -40, -80), // 6. Sudoeste (FUNDO - passa por baixo)
      new THREE.Vector3(50, -35, -50), // 7. Sudeste
      new THREE.Vector3(80, -28, -100), // 8. Curva leste-sul
      new THREE.Vector3(40, -22, -120), // 9. Sul
      new THREE.Vector3(-40, -16, -100), // 10. Curva sudoeste
      new THREE.Vector3(-80, -12, -60), // 11. Aproximação SW (RASO - passa por cima)
      new THREE.Vector3(-50, -10, -30), // 12. Entrada final (RASO - passa por cima)
      new THREE.Vector3(0, -10, 0), // 13. Centro (fim)
    ];

    // Armazenar dados do túnel para colisão
    this.tunnelPath = [];
    this.tunnelRadius = 16; // Raio aumentado do túnel

    // Criar curva suave usando Catmull-Rom spline
    const curve = new THREE.CatmullRomCurve3(
      checkpoints,
      false,
      "catmullrom",
      0.5,
    );
    const points = curve.getPoints(200); // 200 pontos para curva suave

    // Armazenar pontos do caminho para colisão
    this.tunnelPath = points;

    // Material do túnel (sólido, semi-transparente para ver por dentro)
    const tunnelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a4a6e,
      transparent: true,
      opacity: 0.4,
      side: THREE.BackSide, // Renderizar lado interno
      metalness: 0.3,
      roughness: 0.7,
    });

    // Criar geometria do tubo
    const tubeGeometry = new THREE.TubeGeometry(
      curve,
      150,
      this.tunnelRadius,
      16,
      false,
    );
    const tunnel = new THREE.Mesh(tubeGeometry, tunnelMaterial);
    tunnel.name = "obstacle-tunnel";
    this.scene.add(tunnel);

    // Adicionar grade/estrutura externa do túnel
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
    const wireframe = new THREE.Mesh(tubeGeometry.clone(), wireframeMaterial);
    this.scene.add(wireframe);

    // Adicionar anéis de reforço ao longo do túnel
    const ringCount = 40;
    for (let i = 0; i <= ringCount; i++) {
      const t = i / ringCount;
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t);

      // Anel externo (estrutura)
      const ringGeometry = new THREE.TorusGeometry(
        this.tunnelRadius + 0.5,
        0.3,
        8,
        24,
      );
      const ringMaterial = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        metalness: 0.6,
        roughness: 0.3,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.copy(point);

      // Orientar o anel perpendicular à curva
      const quaternion = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      quaternion.setFromUnitVectors(up, tangent);
      ring.setRotationFromQuaternion(quaternion);
      ring.rotateX(Math.PI / 2);

      this.scene.add(ring);
    }

    // Linha central guia (mais visível)
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.6,
    });
    const centerLine = new THREE.Line(lineGeometry, lineMaterial);
    this.scene.add(centerLine);

    // Adicionar checkpoints numerados
    this.createCheckpointMarkers(checkpoints);

    // Adicionar obstáculos dentro do túnel
    this.createTunnelObstacles(curve);
  }

  createTunnelObstacles(curve) {
    this.tunnelObstacles = [];

    // Configuração dos obstáculos
    const obstacleCount = 40; // Número de obstáculos no túnel
    // Mais paredes (beam aparece 3x mais)
    const obstacleTypes = ["box", "cylinder", "sphere", "beam", "beam", "beam"];

    // Materiais para os obstáculos
    const obstacleMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      metalness: 0.7,
      roughness: 0.3,
      emissive: 0x330000,
    });

    const warningMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      metalness: 0.5,
      roughness: 0.4,
      emissive: 0x331100,
    });

    // Rastrear posições das paredes para evitar sobreposição
    const wallPositions = [];
    const minWallDistance = 25; // Distância mínima entre paredes

    // Espalhar obstáculos ao longo do túnel
    for (let i = 0; i < obstacleCount; i++) {
      // Posição ao longo da curva (evitar início e fim)
      const t = 0.05 + (i / obstacleCount) * 0.9; // Mais espaçado
      const centerPoint = curve.getPoint(t);
      const tangent = curve.getTangent(t);

      // Calcular vetores perpendiculares
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const realUp = new THREE.Vector3()
        .crossVectors(right, tangent)
        .normalize();

      // Escolher tipo de obstáculo
      const type =
        obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];

      // Se for parede, verificar distância das outras paredes
      if (type === "beam") {
        let tooClose = false;
        for (const wallPos of wallPositions) {
          if (centerPoint.distanceTo(wallPos) < minWallDistance) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) {
          continue; // Pular esta posição
        }
        wallPositions.push(centerPoint.clone());
      }

      // Posição - paredes no centro, outros com offset
      const position = centerPoint.clone();
      if (type !== "beam") {
        const offsetDist = (Math.random() - 0.5) * (this.tunnelRadius * 0.8);
        const offsetHeight = (Math.random() - 0.5) * (this.tunnelRadius * 0.6);
        position.addScaledVector(right, offsetDist);
        position.addScaledVector(realUp, offsetHeight);
      }
      const material = Math.random() > 0.5 ? obstacleMaterial : warningMaterial;

      let obstacle;
      let collisionRadius;

      switch (type) {
        case "box":
          const boxSize = 5 + Math.random() * 2;
          const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
          obstacle = new THREE.Mesh(boxGeo, material);
          obstacle.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
          );
          collisionRadius = boxSize * 0.8;
          break;

        case "cylinder":
          const cylRadius = 3 + Math.random() * 1.2;
          const cylHeight = 2 + Math.random() * 4;
          const cylGeo = new THREE.CylinderGeometry(
            cylRadius,
            cylRadius,
            cylHeight,
            12,
          );
          obstacle = new THREE.Mesh(cylGeo, material);
          obstacle.rotation.x = Math.random() * Math.PI;
          obstacle.rotation.z = Math.random() * Math.PI;
          collisionRadius = Math.max(cylRadius, cylHeight / 2) * 0.8;
          break;

        case "sphere":
          const sphereRadius = 5 + Math.random() * 1.5;
          const sphereGeo = new THREE.SphereGeometry(sphereRadius, 12, 8);
          obstacle = new THREE.Mesh(sphereGeo, material);
          collisionRadius = sphereRadius;
          break;

        case "beam":
          // Parede com furos que cobre todo o túnel
          const wallThickness = 2.5;
          const tunnelDiameter = this.tunnelRadius * 2;

          // Criar grupo para a parede com furos
          obstacle = new THREE.Group();

          // Grade 3x3 com furos
          const sections = 3;
          const sectionSize = tunnelDiameter / sections;

          // Escolher 2-3 furos aleatórios (garantir passagem)
          const holeCount = 2 + Math.floor(Math.random() * 2);
          const holes = new Set();

          // Garantir pelo menos um furo no centro ou cantos
          const preferredHoles = [4, 0, 2, 6, 8]; // Centro e cantos
          holes.add(
            preferredHoles[Math.floor(Math.random() * preferredHoles.length)],
          );

          // Adicionar mais furos aleatórios
          while (holes.size < holeCount) {
            holes.add(Math.floor(Math.random() * 9));
          }

          // Criar cada seção (exceto os furos)
          for (let row = 0; row < sections; row++) {
            for (let col = 0; col < sections; col++) {
              const index = row * sections + col;

              if (holes.has(index)) continue; // Furo - não criar

              // Criar bloco sólido
              const blockGeo = new THREE.BoxGeometry(
                sectionSize - 0.3, // Pequeno gap visual
                sectionSize - 0.3,
                wallThickness,
              );
              const block = new THREE.Mesh(blockGeo, material);

              // Posicionar na grade
              block.position.x = (col - 1) * sectionSize;
              block.position.y = (row - 1) * sectionSize;

              obstacle.add(block);
            }
          }

          // Orientar perpendicular ao túnel
          const wallQuat = new THREE.Quaternion();
          wallQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
          obstacle.setRotationFromQuaternion(wallQuat);

          obstacle.userData.isWall = true;
          collisionRadius = 0; // Usar box collision dos blocos
          break;
      }

      obstacle.position.copy(position);
      obstacle.name = `tunnel-obstacle-${i}`;
      obstacle.userData.collisionRadius = collisionRadius;
      obstacle.userData.type = type;

      this.scene.add(obstacle);
      this.tunnelObstacles.push(obstacle);
    }

    console.log(`🚧 ${obstacleCount} obstáculos criados no túnel`);
  }

  checkObstacleCollision() {
    if (!this.tunnelObstacles || this.tunnelObstacles.length === 0) return;

    const rovPos = this.rov.position.clone();
    const rovRadius = this.getROVCollisionRadius(); // Usar hitbox do modelo atual

    for (const obstacle of this.tunnelObstacles) {
      let obstaclePos = obstacle.position.clone();
      let isColliding = false;

      // Colisão especial para paredes (verifica cada bloco)
      if (obstacle.userData.isWall && obstacle.children) {
        for (const block of obstacle.children) {
          const box = new THREE.Box3().setFromObject(block);
          // Expandir levemente pelo raio do ROV
          box.expandByScalar(rovRadius * 0.5);
          if (box.containsPoint(rovPos)) {
            isColliding = true;
            // Usar posição do bloco específico
            obstaclePos = block.getWorldPosition(new THREE.Vector3());
            break;
          }
        }
      } else {
        // Colisão esférica para outros obstáculos
        const obstacleRadius = obstacle.userData.collisionRadius || 2;
        const distance = rovPos.distanceTo(obstaclePos);
        const minDist = rovRadius + obstacleRadius;
        isColliding = distance < minDist;
      }

      if (isColliding) {
        // Aplicar dano com cooldown
        const now = Date.now();
        const canDamage =
          !obstacle.userData.lastHit || now - obstacle.userData.lastHit > 500;

        if (canDamage) {
          obstacle.userData.lastHit = now;
          const damageAmount = 10;
          this.damage = Math.min(this.maxDamage, this.damage + damageAmount);

          // Feedback
          this.addEvent("warning", `💥 Colisão! Dano: ${damageAmount}%`);

          // Vibrar controle (suave)
          if (this.gamepadController) {
            this.gamepadController.vibrateCollision(0.6);
          }
        }

        // Empurrar suavemente
        const pushDir = rovPos.clone().sub(obstaclePos).normalize();
        this.rov.position.addScaledVector(pushDir, 0.4);

        // Reduzir velocidade apenas na direção do obstáculo
        const velDot = this.rov.velocity.dot(pushDir);
        if (velDot < 0) {
          this.rov.velocity.addScaledVector(pushDir, -velDot * 0.9);
        }

        // Verificar destruição
        if (this.damage >= this.maxDamage) {
          this.missionFailed = true;
          this.addEvent("danger", "💀 ROV DESTRUÍDO!");
        }

        break; // Só uma colisão por frame
      }
    }
  }

  createCheckpointMarkers(checkpoints) {
    for (let i = 0; i < checkpoints.length - 1; i++) {
      const pos = checkpoints[i];

      // Criar sprite com número do checkpoint
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "rgba(0, 255, 136, 0.9)";
      ctx.beginPath();
      ctx.arc(64, 64, 55, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#000";
      ctx.font = "bold 70px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((i + 1).toString(), 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(pos);
      sprite.position.y += this.tunnelRadius + 3;
      sprite.scale.set(6, 6, 1);

      this.scene.add(sprite);

      // Adicionar seta de direção para o próximo checkpoint
      if (i < checkpoints.length - 2) {
        const nextPos = checkpoints[i + 1];
        const direction = new THREE.Vector3()
          .subVectors(nextPos, pos)
          .normalize();

        const arrowGeometry = new THREE.ConeGeometry(1.5, 4, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({
          color: 0xffff00,
          transparent: true,
          opacity: 0.9,
        });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);

        const arrowPos = pos.clone().add(direction.clone().multiplyScalar(12));
        arrow.position.copy(arrowPos);

        const axis = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          axis,
          direction,
        );
        arrow.setRotationFromQuaternion(quaternion);

        this.scene.add(arrow);
      }
    }
  }

  // Verificar se ROV está dentro do túnel
  checkTunnelCollision() {
    if (!this.tunnelPath || this.tunnelPath.length === 0) return;

    const rovPos = this.rov.position;
    let minDist = Infinity;
    let closestPoint = null;
    let closestIndex = 0;

    // Encontrar o ponto mais próximo no caminho do túnel
    for (let i = 0; i < this.tunnelPath.length; i++) {
      const dist = rovPos.distanceTo(this.tunnelPath[i]);
      if (dist < minDist) {
        minDist = dist;
        closestPoint = this.tunnelPath[i];
        closestIndex = i;
      }
    }

    // Se ROV está fora do túnel (distância + raio do ROV > raio do túnel)
    const rovRadius = this.getROVCollisionRadius();
    const safeDistance = this.tunnelRadius - rovRadius - 0.5; // Margem de segurança

    if (minDist > safeDistance) {
      const now = performance.now() / 1000;
      if (now - this.lastCollisionTime > 0.3) {
        // Cooldown menor para túnel
        this.lastCollisionTime = now;

        // Calcular dano baseado em quanto passou do limite
        const overshoot = minDist - safeDistance;
        const damageAmount = Math.min(15, overshoot * 5);
        this.damage += damageAmount;

        // Empurrar ROV de volta para dentro do túnel
        const pushDir = closestPoint.clone().sub(rovPos).normalize();
        const pushAmount = minDist - safeDistance + 0.3;
        this.rov.position.addScaledVector(pushDir, pushAmount);

        // Reduzir velocidade significativamente
        this.rov.velocity.multiplyScalar(0.2);

        this.addEvent(
          "warning",
          `Colisão com túnel! Dano: ${damageAmount.toFixed(0)}%`,
        );

        // Vibrar controle (feedback háptico)
        if (this.gamepadController) {
          this.gamepadController.vibrateCollision(0.7);
        }

        // Verificar se ROV foi destruído
        if (this.damage >= this.maxDamage) {
          this.missionFailed = true;
          this.addEvent("danger", "ROV DESTRUÍDO!");
        }
      }
    }
  }

  initControls() {
    document.body.tabIndex = 0;
    document.body.focus();

    document.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      this.handleKeyDown(e);
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    document.addEventListener("click", () => {
      document.body.focus();
    });

    // ═══════════════════════════════════════════════════════════════
    // CONTROLE ORBITAL (MOUSE) - APENAS CÂMERA EXTERNA
    // ═══════════════════════════════════════════════════════════════
    const viewport = document.getElementById("viewport-container");

    viewport.addEventListener("mousedown", (e) => {
      if (this.activeCamera === "external") {
        this.orbitControl.isDragging = true;
        this.orbitControl.lastMouseX = e.clientX;
        this.orbitControl.lastMouseY = e.clientY;
        viewport.style.cursor = "grabbing";
      }
    });

    viewport.addEventListener("mousemove", (e) => {
      if (this.orbitControl.isDragging && this.activeCamera === "external") {
        const deltaX = e.clientX - this.orbitControl.lastMouseX;
        const deltaY = e.clientY - this.orbitControl.lastMouseY;

        // Rotação horizontal (theta)
        this.orbitControl.theta -= deltaX * this.orbitControl.sensitivity;

        // Rotação vertical (phi) - limitar para não virar de cabeça para baixo
        this.orbitControl.phi -= deltaY * this.orbitControl.sensitivity;
        this.orbitControl.phi = Math.max(
          0.1,
          Math.min(Math.PI - 0.1, this.orbitControl.phi),
        );

        this.orbitControl.lastMouseX = e.clientX;
        this.orbitControl.lastMouseY = e.clientY;
      }
    });

    viewport.addEventListener("mouseup", () => {
      this.orbitControl.isDragging = false;
      viewport.style.cursor =
        this.activeCamera === "external" ? "grab" : "default";
    });

    viewport.addEventListener("mouseleave", () => {
      this.orbitControl.isDragging = false;
      viewport.style.cursor = "default";
    });

    // Zoom com scroll do mouse (apenas câmera externa)
    viewport.addEventListener(
      "wheel",
      (e) => {
        if (this.activeCamera === "external") {
          e.preventDefault();
          const zoomSpeed = 0.5;
          this.orbitControl.distance += e.deltaY > 0 ? zoomSpeed : -zoomSpeed;
          this.orbitControl.distance = Math.max(
            this.orbitControl.minDistance,
            Math.min(this.orbitControl.maxDistance, this.orbitControl.distance),
          );
        }
      },
      { passive: false },
    );
  }

  handleKeyDown(e) {
    switch (e.code) {
      case "Space":
        e.preventDefault();
        this.isArmed = !this.isArmed;
        this.addEvent(
          this.isArmed ? "success" : "warning",
          this.isArmed ? "ROV Armed" : "ROV Disarmed",
        );
        break;

      case "KeyL":
        this.lightsOn = !this.lightsOn;
        this.lights.forEach((l) => {
          if (l.isSpotLight) l.intensity = this.lightsOn ? 5 : 0;
          else if (l.isPointLight) l.intensity = this.lightsOn ? 1 : 0;
        });
        this.addEvent("info", this.lightsOn ? "Lights ON" : "Lights OFF");
        break;

      case "KeyC":
        const cameraNames = ["main", "alt", "wide", "external"];
        const currentIndex = cameraNames.indexOf(this.activeCamera);
        const nextIndex = (currentIndex + 1) % cameraNames.length;
        this.activeCamera = cameraNames[nextIndex];
        this.camera = this.cameras[this.activeCamera];

        // Atualizar cursor e mostrar dica para câmera externa
        const viewport = document.getElementById("viewport-container");
        if (this.activeCamera === "external") {
          viewport.style.cursor = "grab";
          this.addEvent(
            "info",
            "Camera: EXTERNAL (Mouse: rotacionar | Scroll: zoom)",
          );
        } else {
          viewport.style.cursor = "default";
          this.addEvent("info", `Camera: ${this.activeCamera.toUpperCase()}`);
        }
        break;

      case "Escape":
        this.isPaused = !this.isPaused;
        break;

      case "ShiftLeft":
      case "ShiftRight":
        this.speedMultiplier = Math.min(
          10.0,
          (this.speedMultiplier || 1) + 0.5,
        );
        this.addEvent(
          "info",
          `Speed: ${Math.round(this.speedMultiplier * 100)}%`,
        );
        break;

      case "ControlLeft":
      case "ControlRight":
        this.speedMultiplier = Math.max(
          0.25,
          (this.speedMultiplier || 1) - 0.25,
        );
        this.addEvent(
          "info",
          `Speed: ${Math.round(this.speedMultiplier * 100)}%`,
        );
        break;

      case "KeyZ":
        // Alternar câmera externa entre rotação automática e manual
        if (this.activeCamera === "external") {
          this.orbitControl.manualRotation = !this.orbitControl.manualRotation;

          if (this.orbitControl.manualRotation) {
            this.addEvent(
              "info",
              "Rotação MANUAL (mouse para girar, Z para auto)",
            );
          } else {
            // Resetar ângulo para trás do ROV
            this.orbitControl.theta = 0;
            this.addEvent("info", "Rotação AUTO (câmera segue ROV)");
          }
        }
        break;

      case "KeyG":
        // Toggle debug visual de colisões
        if (this.collisionSystem) {
          this.collisionSystem.toggleDebug();
          this.addEvent(
            "info",
            `Debug de colisões: ${this.collisionSystem.showDebug ? "ON" : "OFF"}`,
          );
        }
        break;
    }
  }

  initGamepad() {
    // Inicializar controlador de gamepad
    this.gamepadController = new GamepadController(this);
    this.gamepadController.init();
  }

  initHUD() {
    // Implementação do HUD
  }

  updateInput() {
    if (!this.isArmed) {
      this.input = { surge: 0, sway: 0, heave: 0, yaw: 0, pitch: 0, roll: 0 };
      return;
    }

    // Input do teclado
    let kbSurge = (this.keys["KeyW"] ? 1 : 0) - (this.keys["KeyS"] ? 1 : 0);
    let kbSway = (this.keys["KeyD"] ? 1 : 0) - (this.keys["KeyA"] ? 1 : 0);
    let kbHeave = (this.keys["KeyQ"] ? 1 : 0) - (this.keys["KeyE"] ? 1 : 0);
    let kbYaw =
      (this.keys["ArrowLeft"] ? 1 : 0) - (this.keys["ArrowRight"] ? 1 : 0);

    const pitchInput =
      (this.keys["ArrowUp"] ? 1 : 0) - (this.keys["ArrowDown"] ? 1 : 0);
    if (pitchInput !== 0) {
      this.cameraPitch = (this.cameraPitch || 0) + pitchInput * 0.02;
      this.cameraPitch = Math.max(-0.8, Math.min(0.8, this.cameraPitch));
    }

    // Input do gamepad (já definido pelo GamepadController.update())
    const gpSurge = this.input.surge || 0;
    const gpSway = this.input.sway || 0;
    const gpHeave = this.input.heave || 0;
    const gpYaw = this.input.yaw || 0;
    const gpPitch = this.input.pitch || 0;

    // Combinar teclado + gamepad (o que tiver maior valor absoluto vence)
    this.input.surge =
      Math.abs(kbSurge) > Math.abs(gpSurge) ? kbSurge : gpSurge;
    this.input.sway = Math.abs(kbSway) > Math.abs(gpSway) ? kbSway : gpSway;
    this.input.heave =
      Math.abs(kbHeave) > Math.abs(gpHeave) ? kbHeave : gpHeave;
    this.input.yaw = Math.abs(kbYaw) > Math.abs(gpYaw) ? kbYaw : gpYaw;

    // Gamepad pitch ajusta a câmera também
    if (Math.abs(gpPitch) > 0.1) {
      this.cameraPitch = (this.cameraPitch || 0) + gpPitch * 0.03;
      this.cameraPitch = Math.max(-0.8, Math.min(0.8, this.cameraPitch));
    }
  }

  updatePhysics(dt) {
    if (this.isPaused) return;

    const speedMult = this.speedMultiplier || 1.0;
    const maxSpeed = 25 * speedMult;
    const maxAngularSpeed = 10.0 * speedMult;
    const acceleration = 15.0 * speedMult;
    const angularAcceleration = 8.0 * speedMult;

    // ═══════════════════════════════════════════════════════════════
    // SISTEMA DE INÉRCIA REALISTA
    // Valores mais próximos de 1.0 = mais inércia
    // ═══════════════════════════════════════════════════════════════
    const linearDrag = 0.985;
    const angularDrag = 0.975;

    const yaw = this.rov.rotation.y;
    const pitch = this.cameraPitch || 0;

    // Forward 3D - inclui componente vertical baseado no pitch
    const forward = new THREE.Vector3(
      Math.cos(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.sin(yaw) * Math.cos(pitch),
    ).normalize();

    const right = new THREE.Vector3(
      Math.cos(yaw - Math.PI / 2),
      0,
      -Math.sin(yaw - Math.PI / 2),
    );
    const up = new THREE.Vector3(0, 1, 0);

    // ═══════════════════════════════════════════════════════════════
    // APLICAR FORÇA DOS PROPULSORES
    // ═══════════════════════════════════════════════════════════════
    if (this.input.surge !== 0) {
      this.rov.velocity.addScaledVector(
        forward,
        this.input.surge * acceleration * dt,
      );
    }
    if (this.input.sway !== 0) {
      this.rov.velocity.addScaledVector(
        right,
        this.input.sway * acceleration * dt,
      );
    }
    if (this.input.heave !== 0) {
      this.rov.velocity.addScaledVector(
        up,
        this.input.heave * acceleration * dt,
      );
    }

    // Rotação (yaw)
    if (this.input.yaw !== 0) {
      this.rov.angularVelocity.y += this.input.yaw * angularAcceleration * dt;
    }

    // Aplicar corrente marítima
    this.rov.velocity.x += (this.environment.currentX || 0) * dt * 0.3;
    this.rov.velocity.z += (this.environment.currentY || 0) * dt * 0.3;

    // ═══════════════════════════════════════════════════════════════
    // APLICAR ARRASTO HIDRODINÂMICO (INÉRCIA)
    // ═══════════════════════════════════════════════════════════════
    const speed = this.rov.velocity.length();
    if (speed > 0.001) {
      const dragCoeff = 1 - Math.pow(linearDrag, dt * 60);
      this.rov.velocity.multiplyScalar(1 - dragCoeff);

      if (this.rov.velocity.length() < 0.01) {
        this.rov.velocity.set(0, 0, 0);
      }
    }

    // Arrasto angular
    if (Math.abs(this.rov.angularVelocity.y) > 0.001) {
      const angularDragCoeff = 1 - Math.pow(angularDrag, dt * 60);
      this.rov.angularVelocity.y *= 1 - angularDragCoeff;

      if (Math.abs(this.rov.angularVelocity.y) < 0.001) {
        this.rov.angularVelocity.y = 0;
      }
    }

    // Limitar velocidades
    if (this.rov.velocity.length() > maxSpeed) {
      this.rov.velocity.normalize().multiplyScalar(maxSpeed);
    }
    this.rov.angularVelocity.y = Math.max(
      -maxAngularSpeed,
      Math.min(maxAngularSpeed, this.rov.angularVelocity.y),
    );

    // Atualizar posição
    this.rov.position.addScaledVector(this.rov.velocity, dt);

    // Verificar e aplicar colisões
    if (this.collisionSystem) {
      const correction = this.collisionSystem.checkCollisions(
        this.rov.position,
        this.rov.rotation,
      );

      // Aplicar correção de posição
      if (correction.length() > 0) {
        this.rov.position.add(correction);

        // Reduzir velocidade na direção da colisão
        const correctionNorm = correction.clone().normalize();
        const velocityInCollisionDir = this.rov.velocity.dot(correctionNorm);
        if (velocityInCollisionDir < 0) {
          this.rov.velocity.addScaledVector(
            correctionNorm,
            -velocityInCollisionDir * 0.8,
          );
        }

        // Feedback visual/sonoro de colisão (opcional)
        if (correction.length() > 0.01) {
          this.addEvent("warning", "⚠️ Colisão detectada!");
        }
      }
    }

    // Atualizar rotação
    this.rov.rotation.y += this.rov.angularVelocity.y * dt;

    // Limites do ambiente
    if (this.rov.position.y > -2) {
      this.rov.position.y = -2;
      this.rov.velocity.y = Math.min(0, this.rov.velocity.y);
    }
    const minAlt = -this.environment.seabedDepth + 1;
    if (this.rov.position.y < minAlt) {
      this.rov.position.y = minAlt;
      this.rov.velocity.y = Math.max(0, this.rov.velocity.y);
    }

    // Atualizar modelo
    if (this.rovModel) {
      this.rovModel.position.copy(this.rov.position);
      this.rovModel.rotation.set(0, this.rov.rotation.y, 0);
    }

    // Atualizar câmeras
    this.updateCameras();
  }

  updateCameras() {
    // Delegar para o CameraController
    if (this.cameraController) {
      this.cameraController.updateCameras();
    } else {
      console.warn("CameraController não inicializado!");
    }
  }

  checkCollisions() {
    // Verificar colisão com obstáculos
    const rovRadius = this.getROVCollisionRadius();

    for (const obstacle of this.obstacles) {
      if (!obstacle.position) continue;

      const dist = this.rov.position.distanceTo(obstacle.position);
      const minDist = (obstacle.radius || 1) + rovRadius;

      if (dist < minDist) {
        // Colisão detectada
        const now = performance.now() / 1000;
        if (now - this.lastCollisionTime > this.collisionCooldown) {
          this.lastCollisionTime = now;

          // Calcular dano baseado na velocidade
          const impactSpeed = this.rov.velocity.length();
          const damageAmount = Math.min(20, impactSpeed * 3);
          this.damage += damageAmount;

          // Empurrar ROV para fora
          const pushDir = this.rov.position
            .clone()
            .sub(obstacle.position)
            .normalize();
          this.rov.position.addScaledVector(pushDir, minDist - dist + 0.1);

          // Reduzir velocidade
          this.rov.velocity.multiplyScalar(0.3);

          this.addEvent(
            "warning",
            `Colisão! Dano: ${damageAmount.toFixed(0)}%`,
          );

          // Verificar se ROV foi destruído
          if (this.damage >= this.maxDamage) {
            this.missionFailed = true;
            this.addEvent("danger", "ROV DESTRUÍDO!");
          }
        }
      }
    }
  }

  updateObjectives(dt) {
    if (!this.objectives || !this.objectiveMarkers) return;

    for (let i = 0; i < this.objectives.length; i++) {
      const obj = this.objectives[i];
      if (obj.completed) continue;

      // Verificar objetivos do tipo "distance" (chegar a um ponto)
      if (obj.type === "distance" && obj.target) {
        const targetPos = new THREE.Vector3(
          obj.target.x,
          obj.target.y,
          obj.target.z,
        );
        const dist = this.rov.position.distanceTo(targetPos);
        const radius = obj.radius || 5;

        if (dist < radius) {
          obj.completed = true;
          this.score += obj.points;
          this.addEvent("success", `${obj.name} - +${obj.points} pts`);

          // Esconder marcador
          if (this.objectiveMarkers[i]) {
            this.objectiveMarkers[i].visible = false;
          }
        }
      }

      // Verificar objetivos do tipo "auto" (completam automaticamente)
      if (obj.type === "auto" && !obj.completed) {
        obj.completed = true;
        this.score += obj.points;
        this.addEvent("success", `${obj.name} - +${obj.points} pts`);
      }
    }

    // Verificar se todos os objetivos foram completados
    const allCompleted = this.objectives.every((o) => o.completed);
    if (allCompleted && !this.missionCompleted) {
      this.missionCompleted = true;
      this.addEvent("success", "MISSÃO COMPLETA!");
    }
  }

  updateHUD() {
    if (this.hudController) {
      this.hudController.update();
    }
  }

  updateTimer() {
    this.sessionTime += 1 / 60;
    const hours = Math.floor(this.sessionTime / 3600);
    const minutes = Math.floor((this.sessionTime % 3600) / 60);
    const seconds = Math.floor(this.sessionTime % 60);

    const timeStr = [hours, minutes, seconds]
      .map((n) => n.toString().padStart(2, "0"))
      .join(":");

    const clockEl = document.getElementById("clock");
    if (clockEl) clockEl.textContent = timeStr;
  }

  addEvent(type, message) {
    const log = document.getElementById("event-log");
    if (!log) return;

    const hours = Math.floor(this.sessionTime / 3600);
    const minutes = Math.floor((this.sessionTime % 3600) / 60);
    const seconds = Math.floor(this.sessionTime % 60);
    const timeStr = [hours, minutes, seconds]
      .map((n) => n.toString().padStart(2, "0"))
      .join(":");

    const event = document.createElement("div");
    event.className = "event-item";
    event.innerHTML = `
      <span class="event-time">${timeStr}</span>
      <span class="event-type ${type}">${type.toUpperCase()}</span>
      <span class="event-message">${message}</span>
    `;
    log.insertBefore(event, log.firstChild);

    while (log.children.length > 50) {
      log.removeChild(log.lastChild);
    }
  }

  onResize() {
    const container = document.getElementById("viewport-container");
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  start() {
    this.isRunning = true;

    const scenarioNameEl = document.getElementById("scenario-name");
    if (scenarioNameEl) {
      scenarioNameEl.textContent = this.scenarioConfig.name.toUpperCase();
    }

    this.addEvent("info", `Session started - ${this.scenarioConfig.name}`);
    this.addEvent("info", this.scenarioConfig.description);
    this.addEvent("success", "Launch sequence complete");
    this.addEvent(
      "info",
      `Depth: ${Math.abs(this.scenarioConfig.startY || -30)}m | Visibility: ${
        this.scenarioConfig.visibility
      }m`,
    );
    this.addEvent("info", "ROV armed - ready for operation");

    this.animate();
  }

  animate() {
    if (!this.isRunning) return;

    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.1);

    // Atualizar gamepad (se conectado)
    if (this.gamepadController) {
      this.gamepadController.update();
    }

    this.updateInput();
    this.updatePhysics(dt);
    this.checkCollisions();

    // Verificar colisões no training_arena
    if (this.scenarioId === "training_arena") {
      this.checkTunnelCollision();
      this.checkObstacleCollision();
    }

    this.updateObjectives(dt);
    this.updateHUD();
    this.updateTimer();

    this.renderer.render(this.scene, this.camera);
  }

  resetCameraSettings() {
    // Só resetar se as câmeras já existirem
    if (!this.cameras || !this.cameras.main) {
      console.log("Câmeras ainda não criadas, aguardando...");
      return;
    }
    
    // Resetar para câmera principal
    this.activeCamera = "main";
    this.camera = this.cameras.main;
    
    // Resetar controle orbital
    this.orbitControl = {
      isDragging: false,
      theta: 0, // Ângulo horizontal (ao redor do ROV)
      phi: Math.PI / 4, // Ângulo vertical (elevação)
      distance: 15, // Distância do ROV
      minDistance: 3,
      maxDistance: 50,
      sensitivity: 0.005,
      lastMouseX: 0,
      lastMouseY: 0,
      manualRotation: false, // Sempre começar em modo automático
    };
    
    // Resetar pitch da câmera
    this.cameraPitch = 0;
    
    console.log("Configurações da câmera resetadas - câmera ativa:", this.activeCamera);
  }
}

export default ROVSimulator;
