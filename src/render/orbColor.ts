import type { Genes } from '../game/genes'

/** An orb's colour tells its character: red for aggression, green for appetite, blue for caution. */
export function orbColor(genes: Genes): string {
  const r = Math.min(255, genes.aggression_weight * 100 + genes.aggression_hp_sensitivity * 100)
  const g = Math.min(255, genes.hunger_weight * 100 + genes.hunger_hp_sensitivity * 50)
  const b = Math.min(255, genes.fear_weight * 100 + genes.exploration_weight * 20)
  return `rgb(${r}, ${g}, ${b})`
}
