/**
 * Things that happen during a turn that the UI may want to visualise.
 * The simulation only reports them; timing and rendering belong to the UI.
 */
export type SimEvent =
  | { type: 'consume'; orbId: string }
  | {
      type: 'bite' | 'attack' | 'birth'
      orbId: string
      fromX: number
      fromY: number
      toX: number
      toY: number
    }
