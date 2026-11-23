import type { Settings } from '../game/settings'

const SHORTCUTS: Array<{ keys: string[]; separator?: string; description: string }> = [
  { keys: ['Space'], description: 'Toggle time (pause / resume)' },
  { keys: ['+', '-'], separator: ' / ', description: 'Increase / decrease speed' },
  { keys: ['1', '5'], separator: '–', description: 'Set speed (slow → fast)' },
  { keys: [']'], description: 'Next turn (pauses first)' },
  { keys: ['Esc'], description: 'Deselect orb' },
  { keys: ['G'], description: 'Toggle graphics' },
  { keys: ['M'], description: 'Restart' },
  { keys: ['N'], description: 'Reseed the world from the best orbs' },
  { keys: ['S'], description: 'Settings' },
  { keys: ['O'], description: 'Orbs List' }
]

/** Trims a number to at most one decimal for display. */
function short(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/**
 * The main rules of the game, with the numbers taken from the settings in
 * use, and the keyboard shortcuts. When a rule in `src/game` changes, its
 * sentence here has to change with it.
 */
export function HelpPanel({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const [ rows, cols ] = settings.worldSize
  const rainPerTurn = (rows * cols * settings.energyRainPer1000Cells) / 1000
  const hpPerEnergy = settings.hpGainByEnergyConsumption
  const bitePercent = Math.round(settings.bitePercentOfAttackerHp * 100)
  const keptPercent = Math.round((1 - settings.biteWasteFraction) * 100)

  return (
    <div className="help-panel" role="dialog" aria-label="Rules and shortcuts">
      <div className="help-panel-header">
        <div>Rules and shortcuts</div>
        <button onClick={onClose}>⤫</button>
      </div>

      <div className="help-panel-body">
        <div className="help-rules">
          <h3>The world</h3>
          <ul>
            <li>
              The world is a grid of {rows} by {cols} cells. A cell can hold energy and one orb.
            </li>
            <li>
              Every turn about {short(rainPerTurn)} units of energy fall on random cells. A cell holds at most{' '}
              {settings.energyCellCap}, and rain that lands on a full cell is lost.
            </li>
            {settings.energyCreatedOnDeath > 0 ? (
              <li>A dead orb leaves {settings.energyCreatedOnDeath} energy on its cell.</li>
            ) : (
              <li>Rain is the only source of energy. A dead orb leaves nothing behind.</li>
            )}
          </ul>

          <h3>Orbs</h3>
          <ul>
            <li>An orb lives on HP and dies when its HP reaches 0. The number on an orb is its HP.</li>
            <li>
              Every turn each orb takes one action and then pays upkeep: 1 HP plus {short(settings.upkeepPercentOfHp)}%
              of its HP. A big orb costs more to keep alive than a small one.
            </li>
            <li>
              An orb senses energy and other orbs within {settings.scanRadius}{' '}
              {settings.scanRadius === 1 ? 'cell' : 'cells'} of itself.
            </li>
          </ul>

          <h3>Actions</h3>
          <dl>
            <dt>Move</dt>
            <dd>Step to a free neighbouring cell, in any of 8 directions.</dd>
            <dt>Eat</dt>
            <dd>Take 1 energy from the cell under the orb and gain {hpPerEnergy} HP.</dd>
            <dt>Bite</dt>
            <dd>
              Take HP from a neighbour, up to {bitePercent}% of the biter's own HP. The biter keeps {keptPercent}% of
              the bite and loses at least {settings.biteWasteMin} HP of it. The lost part falls to the ground as
              energy, 1 unit for every {hpPerEnergy} HP.
            </dd>
            <dt>Attack</dt>
            <dd>Deal the damage of a bite and gain nothing. Orbs use it against neighbours they fear.</dd>
            <dt>Divide</dt>
            <dd>
              Put a child on a free cell above, below, left or right. The child gets the share of the parent's HP
              set by the gene <code>offspring_investment</code>. The parent also loses {settings.birthTaxPercent}% of
              its HP as a birth tax, then waits <code>reproduction_cooldown</code> turns before the next child.
            </dd>
            <dt>Wait</dt>
            <dd>Do nothing.</dd>
          </dl>

          <h3>How an orb decides</h3>
          <ul>
            <li>
              Each turn the orb's genes turn its HP and surroundings into five motivations: hunger, fear,
              aggression, the urge to reproduce and curiosity.
            </li>
            <li>
              Every action the orb could take gets a score from these motivations, and the highest score wins.
              Repeating the last action earns a small bonus (<code>inertia_bias</code>), every score gets some
              random noise (<code>decision_noise</code>), and now and then the orb acts at random
              (<code>impulsiveness</code>).
            </li>
            <li>
              An orb recognises relatives through shared ancestors. Its genes decide how much it trusts them and
              whether it bites them.
            </li>
            <li>
              Click an orb to see its genes, what it senses and its log. The browser console explains every
              decision of the selected orb.
            </li>
          </ul>

          <h3>Evolution</h3>
          <ul>
            <li>
              A child copies its parent's genes with small random changes. The gene{' '}
              <code>mutation_resilience</code> makes the changes smaller.
            </li>
            <li>
              Nothing else does the selecting. Orbs that find food and divide leave descendants, and the rest
              disappear.
            </li>
            <li>
              The first orbs are four preset characters: a balanced one, an aggressive loner, a herd grazer and an
              explorer.
            </li>
          </ul>

          <h3>Generations</h3>
          <ul>
            <li>
              The world never resets while an orb is alive.{' '}
              {settings.generationLengthTurns > 0
                ? `A generation is a stretch of ${settings.generationLengthTurns} turns with its own statistics.`
                : 'A generation lasts until every orb is dead.'}
            </li>
            <li>
              If every orb dies, the world is reseeded. The {settings.newGenStrongestCount} orbs of the generation
              with the most children, the older first among equals, each get {settings.newGenOffspringPerParent}{' '}
              mutated offspring with {settings.initialOrbHP[0]} to {settings.initialOrbHP[1]} HP.
              {settings.resetEnergyOnNewGenerations &&
                ` The energy on the map is replaced by ${settings.initialEnergyOnMap} fresh units.`}
            </li>
          </ul>
        </div>

        <div className="help-shortcuts">
          <h3>Shortcuts</h3>
          <div className="shortcuts-grid">
            {SHORTCUTS.map(({ keys, separator, description }) => (
              <div key={description} style={{ display: 'contents' }}>
                <div className="shortcut-key">
                  {keys.map((key, index) => (
                    <span key={key}>
                      {index > 0 && separator}
                      <kbd>{key}</kbd>
                    </span>
                  ))}
                </div>
                <div className="shortcut-desc">{description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
