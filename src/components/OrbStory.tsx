import React from 'react'
import type { Genes } from '../game/genes'
import { clamp } from '../game/math'
import type { Orb } from '../game/orb'
import type { OrbMotivations, PerceivedCell } from '../game/perception'

type OrbStoryProps = {
  orb: Orb
  /** Scan radius to assume for an orb that has not looked around yet. */
  defaultScanRadius: number
  onClose: () => void
}

/** Everything about one orb: its genes, what it feels and senses, and its life turn by turn. */
export function OrbStory({ orb, defaultScanRadius, onClose }: OrbStoryProps) {
  return (
    <div className="orb-story">
      <div className="orb-story__header">
        <div>{orb.name}</div>
        <button onClick={onClose}>⤫</button>
      </div>

      <div className="orb-story__content">
        <div className="commands-section">
          <div className="commands-title">Genes</div>
          <GenesTable genes={orb.genes} />
        </div>

        <div className="commands-section commands-section--column">
          <div>
            <div className="commands-title">Motivations</div>
            <MotivationsTable motivations={orb.lastMotivations} />
          </div>

          <div>
            <div className="commands-title">Surroundings</div>
            {orb.lastPerception.length > 0 ? (
              <PerceptionGrid
                perception={orb.lastPerception}
                radius={orb.lastScanRadius || defaultScanRadius}
                maxEnergyNorm={orb.genes.max_energy_norm}
              />
            ) : (
              <div className="empty">No snapshot yet</div>
            )}
          </div>
        </div>

        <div className="commands-section">
          <div className="commands-title">My Story</div>
          <div className="log-column">
            {orb.log.map((turnItems, turnIndex) => (
              <div key={turnIndex} className="log-row" title={`Turn ${turnIndex}`}>
                <div>{turnIndex}.</div>
                {turnItems.map((entry, entryIndex) => (
                  <div key={entryIndex} className="log-block">
                    {entry}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function GenesTable({ genes }: { genes: Genes }) {
  return (
    <div className="genes-table" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px' }}>
      {Object.entries(genes).map(([ name, value ]) => (
        <React.Fragment key={name}>
          <div title={name} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ textAlign: 'right' }}>{value.toFixed(2)}</div>
        </React.Fragment>
      ))}
    </div>
  )
}

function MotivationsTable({ motivations: m }: { motivations: OrbMotivations | null }) {
  if (!m) {
    return <div className="empty">No snapshot yet</div>
  }
  const rows: Array<[string, number]> = [
    ['hunger', m.hunger],
    ['fear', m.fear],
    ['aggression', m.aggression],
    ['reproduction', m.reproduction],
    ['exploration', m.exploration],
  ]
  const derived: Array<[string, number]> = [
    ['hp_norm', m.hpNorm],
    ['risk_drive', m.riskDrive],
    ['fear_effective', m.fearEffective],
    ['max_threat', m.maxThreat],
    ['max_prey', m.maxPrey],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px' }}>
      {rows.map(([ name, value ]) => (
        <React.Fragment key={name}>
          <div>{name}</div>
          <div style={{ textAlign: 'right' }}>{value.toFixed(2)}</div>
        </React.Fragment>
      ))}
      <div style={{ gridColumn: '1 / -1', opacity: 0.7, marginTop: 6 }}>derived</div>
      {derived.map(([ name, value ]) => (
        <React.Fragment key={name}>
          <div style={{ opacity: 0.85 }}>{name}</div>
          <div style={{ textAlign: 'right', opacity: 0.85 }}>{value.toFixed(2)}</div>
        </React.Fragment>
      ))}
    </div>
  )
}

type PerceptionGridProps = {
  perception: PerceivedCell[]
  radius: number
  maxEnergyNorm: number
}

/** The cells the orb scanned, tinted red by threat, green by energy and blue by prey. */
function PerceptionGrid({ perception, radius, maxEnergyNorm }: PerceptionGridProps) {
  const size = radius * 2 + 1
  const cells = new Map(perception.map(c => [ `${c.dx},${c.dy}`, c ] as const))
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${size}, minmax(56px, 1fr))`,
        gap: 4,
        fontSize: 10
      }}
    >
      {Array.from({ length: size * size }).map((_value, i) => {
        const dx = (i % size) - radius
        const dy = Math.floor(i / size) - radius
        const cell = cells.get(`${dx},${dy}`) ?? null
        const isCenter = dx === 0 && dy === 0
        const inBounds = cell?.inBounds ?? false
        const energyNorm = cell ? clamp(cell.energy / Math.max(maxEnergyNorm, 1), 0, 1) : 0
        const background = !inBounds
          ? 'rgba(0,0,0,0.04)'
          : `rgba(${Math.floor((cell?.threat ?? 0) * 255)}, ${Math.floor(energyNorm * 200)}, ${Math.floor((cell?.prey ?? 0) * 255)}, 0.15)`
        const title = cell
          ? `(${cell.x},${cell.y}) d=(${dx},${dy}) energy=${cell.energy} threat=${cell.threat.toFixed(2)} prey=${cell.prey.toFixed(2)} kin=${cell.kinAffinity.toFixed(2)} density=${cell.localDensity.toFixed(2)} occupied=${cell.occupied}`
          : `d=(${dx},${dy})`
        return (
          <div
            key={`${dx},${dy}`}
            title={title}
            style={{
              border: isCenter ? '2px solid rgba(0,0,0,0.7)' : '1px solid rgba(0,0,0,0.15)',
              borderRadius: 6,
              padding: 6,
              background,
              minHeight: 56
            }}
          >
            {!cell ? (
              <div style={{ opacity: 0.6 }}>n/a</div>
            ) : !cell.inBounds ? (
              <div style={{ opacity: 0.6 }}>out</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ opacity: 0.75 }}>{dx},{dy}</div>
                  <div style={{ opacity: 0.75 }}>{cell.energy}</div>
                </div>
                <PerceptionValue label="T" value={cell.threat} />
                <PerceptionValue label="P" value={cell.prey} />
                <PerceptionValue label="K" value={cell.kinAffinity} />
                <PerceptionValue label="D" value={cell.localDensity} dimmed />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PerceptionValue({ label, value, dimmed }: { label: string; value: number; dimmed?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', opacity: dimmed ? 0.75 : undefined }}>
      <div>{label}</div>
      <div>{value.toFixed(2)}</div>
    </div>
  )
}
