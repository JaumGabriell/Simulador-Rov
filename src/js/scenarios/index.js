// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSEA - ROV PROFESSIONAL TRAINING SIMULATOR
// Configurações de Cenários - Índice Principal
// ═══════════════════════════════════════════════════════════════════════════

import { HULL_INSPECTION_SCENARIOS } from "./inspection/hull-inspection.js";
import { PIPELINE_INSPECTION_SCENARIOS } from "./inspection/pipeline-inspection.js";
import { TRAINING_SCENARIOS } from "./skill/training-scenarios.js";
import { EMERGENCY_SCENARIOS } from "./emergency/emergency-scenarios.js";

// ═══════════════════════════════════════════════════════════════════════════
// COMBINAÇÃO DE TODOS OS CENÁRIOS
// Níveis: FÁCIL (1-2) | MÉDIO (3-5) | DIFÍCIL (6-8) | EXPERT (9-12) | LENDÁRIO (13-16)
// ═══════════════════════════════════════════════════════════════════════════

export const SCENARIO_CONFIGS = {
  // Cenários de Inspeção
  ...HULL_INSPECTION_SCENARIOS,
  ...PIPELINE_INSPECTION_SCENARIOS,

  // Cenários de Habilidade/Treinamento
  ...TRAINING_SCENARIOS,

  // Cenários de Emergência
  ...EMERGENCY_SCENARIOS,
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS PARA CENÁRIOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retorna cenários filtrados por categoria
 * @param {string} category - 'inspection', 'skill', 'emergency'
 */
export function getScenariosByCategory(category) {
  return Object.entries(SCENARIO_CONFIGS)
    .filter(([_, config]) => config.category === category)
    .reduce((acc, [key, config]) => {
      acc[key] = config;
      return acc;
    }, {});
}

/**
 * Retorna cenários filtrados por dificuldade
 * @param {string} difficulty - 'easy', 'medium', 'hard', 'expert', 'legendary'
 */
export function getScenariosByDifficulty(difficulty) {
  return Object.entries(SCENARIO_CONFIGS)
    .filter(([_, config]) => config.difficulty === difficulty)
    .reduce((acc, [key, config]) => {
      acc[key] = config;
      return acc;
    }, {});
}

/**
 * Retorna um cenário específico ou o padrão
 * @param {string} scenarioId - ID do cenário
 */
export function getScenario(scenarioId) {
  return SCENARIO_CONFIGS[scenarioId] || SCENARIO_CONFIGS.fpso_inspection;
}

/**
 * Lista todos os IDs de cenários disponíveis
 */
export function getScenarioIds() {
  return Object.keys(SCENARIO_CONFIGS);
}

/**
 * Retorna metadados resumidos de todos os cenários
 */
export function getScenarioList() {
  return Object.entries(SCENARIO_CONFIGS).map(([id, config]) => ({
    id,
    name: config.name,
    difficulty: config.difficulty,
    category: config.category,
    description: config.description,
  }));
}

export default SCENARIO_CONFIGS;
