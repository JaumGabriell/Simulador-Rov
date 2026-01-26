// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSEA - ROV PROFESSIONAL TRAINING SIMULATOR
// Índice Principal de Módulos JavaScript
// ═══════════════════════════════════════════════════════════════════════════

// Core
export { ROVSimulator } from "./core/ROVSimulator.js";
export { Physics } from "./core/physics.js";
export { Controls } from "./core/controls.js";
export { HUD } from "./core/hud.js";

// Scenarios
export {
  SCENARIO_CONFIGS,
  getScenario,
  getScenariosByCategory,
  getScenariosByDifficulty,
} from "./scenarios/index.js";

// Environments
export { EnvironmentFactory } from "./environments/EnvironmentFactory.js";

// Loaders
export { ModelLoader } from "./loaders/model-loader.js";

// Default export
export { ROVSimulator as default } from "./core/ROVSimulator.js";
