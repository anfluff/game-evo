export const ORB_ICON = '🙎‍♂️'

export type ActionType = 'WAIT' | 'MOVE' | 'CONSUME' | 'BITE' | 'ATTACK' | 'DIVIDE'

export interface ActionDecision {
  type: ActionType
  targetX?: number
  targetY?: number
  utility: number
  description: string
  icon: string
}
