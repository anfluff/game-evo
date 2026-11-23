import { clamp } from './math'

export interface Genes {
  // 1. HP & Sensitivities
  fear_hp_sensitivity: number
  hunger_hp_sensitivity: number
  aggression_hp_sensitivity: number
  exploration_hp_sensitivity: number
  risk_tolerance: number
  hp_healthy_norm: number

  // 2. Weights
  fear_weight: number
  hunger_weight: number
  aggression_weight: number
  reproduction_weight: number
  exploration_weight: number

  // 3. Attack / Cannibalism
  cannibalism_factor: number
  attack_margin: number
  retaliation_fear: number
  defense_instinct: number
  kill_greed: number

  // 3.1 Kinship
  trust_in_relatives: number
  aggression_towards_relatives: number
  recognized_ancestry_depth: number

  // 4. Reproduction
  min_hp_to_divide: number
  offspring_investment: number
  reproduction_cooldown: number

  // 5. Spatial / Environment
  max_energy_norm: number
  diagonal_awareness: number
  distance_decay: number
  crowd_preference: number
  inertia_bias: number

  // 6. Stochastic / Evo
  decision_noise: number
  impulsiveness: number
  mutation_resilience: number
}

export const DEFAULT_GENES: Genes = {
  fear_hp_sensitivity: 1.2,
  hunger_hp_sensitivity: 1.0,
  aggression_hp_sensitivity: 0.35,
  exploration_hp_sensitivity: 0.3,
  risk_tolerance: 0.3,
  hp_healthy_norm: 15.0,

  fear_weight: 1.3,
  hunger_weight: 1.1,
  aggression_weight: 0.9,
  reproduction_weight: 0.33,
  exploration_weight: 0.4,

  cannibalism_factor: 0.24,
  attack_margin: 1.2,
  retaliation_fear: 1.0,
  defense_instinct: 0.35,
  kill_greed: 0.5,

  trust_in_relatives: 0.6,
  aggression_towards_relatives: 0.25,
  recognized_ancestry_depth: 4,

  min_hp_to_divide: 0.5,
  offspring_investment: 0.5,
  reproduction_cooldown: 3,

  max_energy_norm: 5.0,
  diagonal_awareness: 0.5,
  distance_decay: 0.7,
  crowd_preference: 0.2,
  inertia_bias: 0.8,

  decision_noise: 0.2,
  impulsiveness: 0.03,
  mutation_resilience: 0.4
}

export const AGGRESSIVE_INDIVIDUAL_GENES: Genes = {
  ...DEFAULT_GENES,
  fear_hp_sensitivity: 0.8,
  aggression_hp_sensitivity: 0.6,
  risk_tolerance: 0.75,
  fear_weight: 0.45,
  hunger_weight: 1.35,
  aggression_weight: 1.8,
  reproduction_weight: 0.25,
  exploration_weight: 0.35,
  cannibalism_factor: 0.9,
  attack_margin: 0.9,
  retaliation_fear: 0.2,
  defense_instinct: 0.25,
  kill_greed: 0.95,
  trust_in_relatives: 0.2,
  aggression_towards_relatives: 0.6,
  recognized_ancestry_depth: 2,
  crowd_preference: 0.05,
  decision_noise: 0.25,
  impulsiveness: 0.06,
  offspring_investment: 0.45
}

export const HERD_HERBIVORE_GENES: Genes = {
  ...DEFAULT_GENES,
  fear_hp_sensitivity: 1.4,
  aggression_hp_sensitivity: 0.2,
  exploration_hp_sensitivity: 0.2,
  risk_tolerance: 0.15,
  fear_weight: 1.6,
  hunger_weight: 1.2,
  aggression_weight: 0.4,
  reproduction_weight: 0.65,
  exploration_weight: 0.25,
  cannibalism_factor: 0.01,
  attack_margin: 1.4,
  retaliation_fear: 1.2,
  defense_instinct: 0.75,
  kill_greed: 0.05,
  trust_in_relatives: 0.95,
  aggression_towards_relatives: 0.02,
  recognized_ancestry_depth: 6,
  offspring_investment: 0.6,
  crowd_preference: 0.7,
  inertia_bias: 0.9,
  decision_noise: 0.15,
  impulsiveness: 0.02
}

export const ADVENTUROUS_EXPLORER_GENES: Genes = {
  ...DEFAULT_GENES,
  fear_hp_sensitivity: 0.9,
  aggression_hp_sensitivity: 0.3,
  exploration_hp_sensitivity: 0.65,
  risk_tolerance: 0.65,
  fear_weight: 0.9,
  hunger_weight: 1.0,
  aggression_weight: 0.75,
  reproduction_weight: 0.19,
  exploration_weight: 1.0,
  cannibalism_factor: 0.08,
  attack_margin: 1.15,
  retaliation_fear: 0.75,
  defense_instinct: 0.4,
  kill_greed: 0.3,
  trust_in_relatives: 0.5,
  aggression_towards_relatives: 0.2,
  recognized_ancestry_depth: 4,
  offspring_investment: 0.45,
  diagonal_awareness: 0.8,
  distance_decay: 0.9,
  crowd_preference: 0.1,
  inertia_bias: 0.5,
  decision_noise: 0.35,
  impulsiveness: 0.08
}

export const SPAWN_ARCHETYPES: Genes[] = [
  DEFAULT_GENES,
  AGGRESSIVE_INDIVIDUAL_GENES,
  HERD_HERBIVORE_GENES,
  ADVENTUROUS_EXPLORER_GENES
]

/** Copy of the ancestor's genes with every gene nudged; `mutation_resilience` damps the nudge. */
export function mutateGenes(ancestor: Genes, kinshipMaxDepth: number): Genes {
  const next = { ...ancestor }
  const mutationResilience = ancestor.mutation_resilience
  const scale = 1 - mutationResilience
  
  // Mutate all keys
  for (const key of Object.keys(next) as (keyof Genes)[]) {
     if (key === 'mutation_resilience') continue 
     if (key === 'reproduction_cooldown') {
       const base = Math.round(Number(next[key]) || 0)
       const delta = Math.round((Math.random() - 0.5) * 2 * 2 * scale)
       next[key] = clamp(base + delta, 0, 10)
       continue
     }
     if (key === 'recognized_ancestry_depth') {
       const base = Math.round(Number(next[key]) || 0)
       const delta = Math.round((Math.random() - 0.5) * 2 * 2 * scale)
       next[key] = clamp(base + delta, 1, kinshipMaxDepth)
       continue
     }

     const val = next[key]
     // Mutate by +/- 20% scaled by resilience
     const delta = (Math.random() - 0.5) * 2 * 0.2 * scale * val 
     // Additive noise for small params
     const additive = (Math.random() - 0.5) * 0.1 * scale
     
     let newVal = val + delta + additive
     
     if (
        key.endsWith('_weight') ||
        key === 'hp_healthy_norm' ||
        key === 'max_energy_norm' ||
        key.endsWith('_sensitivity') ||
        key === 'attack_margin'
      ) {
        newVal = Math.max(0.1, newVal)
     } else {
        newVal = clamp(newVal, 0, 1)
     }
     
     next[key] = newVal
  }
  
  // Mutate resilience
  next.mutation_resilience = clamp(next.mutation_resilience + (Math.random() - 0.5) * 0.1, 0, 1)
  
  return next
}
