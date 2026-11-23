export const deathReasons = {
  /** The last hp went to a bite. */
  EATEN: 'eaten',
  /** The last hp went to an attack. */
  KILLED: 'killed',
  /** The last hp went to upkeep. */
  NO_HP: 'no_hp'
} as const

export type DeathReason = typeof deathReasons[keyof typeof deathReasons]

export type GenerationStats = {
  reasons: Record<DeathReason, number>
  turns: number
  /** Living orbs summed over the turns played, for the average population. */
  populationSum: number
  /** Age of the oldest orb that lived in the generation, dead or still alive. */
  highestAge: number
  energyStart: number
  births: number
  consumedEnergy: number
  hpGainedFromEating: number
  hpGainedFromConsumingEnergy: number
}

export function createGenerationStats(): GenerationStats {
  return {
    reasons: {
      eaten: 0,
      killed: 0,
      no_hp: 0
    },
    turns: 0,
    populationSum: 0,
    highestAge: 0,
    energyStart: 0,
    births: 0,
    consumedEnergy: 0,
    hpGainedFromEating: 0,
    hpGainedFromConsumingEnergy: 0
  }
}
