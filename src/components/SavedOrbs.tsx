type SavedOrb = {
  id: string
  name: string
  dna: number[]
  reactions: number[][]
}

type Color = { reds: number; greens: number }

type SavedOrbsProps = {
  title?: string
  savedOrbs: SavedOrb[]
  getColorFromDNA: (dna: number[]) => Color
  onSpawn: (orb: SavedOrb) => void
  onEdit: (orb: SavedOrb) => void
  onDelete: (id: string) => void
  compact?: boolean
}

export function SavedOrbs({
  title = 'Saved Orbs',
  savedOrbs,
  getColorFromDNA,
  onSpawn,
  onEdit,
  onDelete,
  compact = false
}: SavedOrbsProps) {
  return (
    <div className={compact ? 'saved-orbs-section compact' : 'saved-orbs-section'}>
      <div className="strongest-orbs-title">{title}</div>
      <div className="saved-orbs-grid">
        {savedOrbs.length > 0 ? (
          savedOrbs.map((o) => {
            const color = getColorFromDNA(o.dna)
            return (
              <div
                key={`saved-user-orb-${o.id}`}
                className="saved-orb"
                title={o.name}
              >
                <div
                  className="saved-orb-circle"
                  style={{ backgroundColor: `rgb(${color.reds}, ${color.greens}, 0)` }}
                />
                <div className="saved-orb-id">{o.name}</div>
                <div className="saved-orb-actions">
                  <button title="Spawn" onClick={(e) => { e.stopPropagation(); onSpawn(o) }}>🪄 Spawn</button>
                  <button title="Edit" onClick={(e) => { e.stopPropagation(); onEdit(o) }}>✏️ Edit</button>
                  <button title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(o.id) }}>🗑️ Delete</button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="saved-orbs-empty">No saved orbs yet.</div>
        )}
      </div>
    </div>
  )
}
