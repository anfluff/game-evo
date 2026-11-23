import type { GenerationStats } from '../game/stats'

export type GenerationMetric = {
  key: string
  value: (stats: GenerationStats) => number
  /** Line colour in the chart. */
  color: string
}

/** Every per-generation number the panels show, in the order of the top/bottom lists. */
export const GENERATION_METRICS: GenerationMetric[] = [
  { key: 'turns', value: s => s.turns, color: '78, 161, 243' },
  { key: 'avg_population', value: s => Math.round(s.populationSum / Math.max(s.turns, 1)), color: '230, 126, 34' },
  { key: 'highest_age', value: s => s.highestAge, color: '243, 156, 18' },
  { key: 'energy_start', value: s => s.energyStart, color: '52, 152, 219' },
  { key: 'births', value: s => s.births, color: '26, 188, 156' },
  { key: 'consumed_energy', value: s => s.consumedEnergy, color: '46, 204, 113' },
  { key: 'hp_gained_eating', value: s => s.hpGainedFromEating, color: '241, 196, 15' },
  { key: 'hp_gained_consuming_energy', value: s => s.hpGainedFromConsumingEnergy, color: '142, 68, 173' },
  { key: 'eaten', value: s => s.reasons.eaten, color: '231, 76, 60' },
  { key: 'killed', value: s => s.reasons.killed, color: '155, 89, 182' },
  { key: 'no_hp', value: s => s.reasons.no_hp, color: '149, 165, 166' }
]

const METRIC_BY_KEY = new Map(GENERATION_METRICS.map(metric => [ metric.key, metric ]))

/** Picks metrics by key, keeping the order given. */
export function metricsInOrder(keys: string[]): GenerationMetric[] {
  return keys.map(key => METRIC_BY_KEY.get(key)!)
}
