import { INERTIA_BONUS, KIN_COMFORT, directionFromDelta, type Candidate, type CandidateTerms, type DecisionFrame, type Encounter } from './decision'

/**
 * Console explanation of one decision of the orb selected for debugging:
 * the orb's state, every candidate action with its scores, and a
 * line-by-line account of how each score came about.
 */

type Outcome = {
  picked: Candidate
  impulsive: boolean
  impulsiveRoll: number
  pickRoll: number | null
}

const f = (value: number) => value.toFixed(3)
const round3 = (value: number) => Number(value.toFixed(3))

function explainEncounter(frame: DecisionFrame, encounter: Encounter): string[] {
  const { genes } = frame.orb
  const parts = encounter.parts ?? []
  const { kernel, diagModifier } = encounter
  const lines: string[] = [
    `This cell has ${parts.length} orb(s): ${parts.map(p => p.other.name).join(', ')}.`,
    `I evaluate kinship (shared ancestors) and adjust threat and prey signals.`,
    `My kinship genes: trust_in_relatives=${f(genes.trust_in_relatives)}, aggression_towards_relatives=${f(genes.aggression_towards_relatives)}.`,
    `Distance decay kernel here is distance_decay^dist = ${f(genes.distance_decay)}^${f(encounter.dist)} = ${f(kernel)}.`,
    `Diagonal modifier is ${f(diagModifier)}.`
  ]

  for (const { other, assessment: a, threatContribution, retaliationFactor, preyContribution } of parts) {
    lines.push(
      `Kinship to ${other.name} is ${f(a.kinship)}. threatModifier=(1-kinship*trust)=(1-${f(a.kinship)}*${f(genes.trust_in_relatives)})=${f(a.threatModifier)}.`,
      `Threat contribution: enemyAdvantage*kernel*diag*threatModifier = ${f(a.enemyAdvantage)}*${f(kernel)}*${f(diagModifier)}*${f(a.threatModifier)} = ${f(threatContribution)}.`,
      `Fear of being hit back is ${f(a.retaliationFear)}, so with defense_instinct=${f(genes.defense_instinct)} the threat counts by a factor of ${f(retaliationFactor)}: ${f(threatContribution * retaliationFactor)}.`,
      `Prey modifier: (1-kinship)+kinship*aggrRel = (1-${f(a.kinship)})+${f(a.kinship)}*${f(genes.aggression_towards_relatives)} = ${f(a.preyModifier)}.`,
      `Prey contribution: preyBase*kernel*diag*preyModifier = ${f(a.preyBase)}*${f(kernel)}*${f(diagModifier)}*${f(a.preyModifier)} = ${f(preyContribution)}.`
    )
  }

  lines.push(
    `After summing all occupants, threatSum=${f(encounter.threatSum)} -> threat(clamped)=${f(encounter.threat)}.`,
    `After summing all occupants, preySum=${f(encounter.preySum)} -> prey(clamped)=${f(encounter.prey)}.`
  )
  return lines
}

function explainTerms(frame: DecisionFrame, terms: CandidateTerms, base: number): string[] {
  const { orb, motivations: m } = frame
  const { genes } = orb
  const W_hunger = genes.hunger_weight
  const W_aggression = genes.aggression_weight
  const W_exploration = genes.exploration_weight
  const W_fear = genes.fear_weight
  const W_reproduction = genes.reproduction_weight
  const here = `${orb.x},${orb.y}`

  switch (terms.kind) {
    case 'WAIT':
      return [
        `I consider WAIT (stay at ${here}).`,
        `My hunger feeling is ${f(m.hunger)} (0=full, 1=starving).`,
        `My fear feeling is ${f(m.fear)}, but effective fear is ${f(m.fearEffective)} (fear reduced by risk-taking).`,
        `Threat at my current cell is ${f(frame.currentThreat)} (0=safe, 1=danger).`,
        ``,
        `Good thing about waiting: it feels safer when threat is low.`,
        `Safety factor = 1 - threat = ${f(1 - frame.currentThreat)}.`,
        `I care about safety with fear weight W_fear=${f(W_fear)}.`,
        `Safety desire = W_fear * effectiveFear = ${f(W_fear)} * ${f(m.fearEffective)} = ${f(W_fear * m.fearEffective)}.`,
        `So the safety bonus for WAIT is: safetyFactor * safetyDesire = ${f(1 - frame.currentThreat)} * ${f(W_fear * m.fearEffective)} = ${f(terms.fear)}.`,
        ``,
        `Another good thing about waiting: I like comfortable space.`,
        `Local crowding here is ${f(frame.currentLocalDensity)} (0=alone, 1=crowded).`,
        `My crowd preference gene is ${f(genes.crowd_preference)} (0=prefer space, 1=prefer crowds).`,
        `So "space preference here" becomes ${f(frame.spacePrefCurrent)}.`,
        `I care about exploration with W_explore=${f(W_exploration)} and my exploration mood is ${f(m.exploration)}.`,
        `Explore desire = W_explore * explorationMood = ${f(W_exploration)} * ${f(m.exploration)} = ${f(W_exploration * m.exploration)}.`,
        `So the explore bonus for WAIT is: spacePref * exploreDesire = ${f(frame.spacePrefCurrent)} * ${f(W_exploration * m.exploration)} = ${f(terms.explore)}.`,
        ``,
        `Bad thing about waiting: hunger pushes me to act.`,
        `Hunger penalty = W_hunger * hunger = ${f(W_hunger)} * ${f(m.hunger)} = ${f(terms.hunger)}.`,
        ``,
        `Relatives around me give comfort for staying here: kinDrive * kinAffinityHere = ${f(frame.kinDrive)} * ${f(frame.kinDrive > 0 ? terms.kin / frame.kinDrive : 0)} = ${f(terms.kin)}.`,
        `Base score for WAIT = safetyBonus + exploreBonus + kin - hungerPenalty = ${f(terms.fear)} + ${f(terms.explore)} + ${f(terms.kin)} - ${f(terms.hunger)} = ${f(base)}.`
      ]

    case 'CONSUME':
      return [
        `I consider CONSUME (eat 1 energy from the ground at ${here}).`,
        `There is ${f(frame.currentEnergy)} energy on this cell.`,
        `Energy normalized (relative to maxEnergyNorm=${f(genes.max_energy_norm)}) is ${f(frame.currentEnergyNorm)}.`,
        `Eating 1 energy would heal me by ${f(frame.hpGainByEnergyConsumption)} hp.`,
        `That heal amount normalized (relative to my healthy hp norm ${f(genes.hp_healthy_norm)}) is ${f(terms.gainNorm)}.`,
        ``,
        `How hungry am I? hunger=${f(m.hunger)} and I care with W_hunger=${f(W_hunger)}.`,
        `Sometimes I "stick" with consuming if I just arrived hungry or I was already consuming.`,
        `Last action type was "${orb.lastActionType ?? ''}".`,
        `Arrived hungry? ${orb.lastActionType === 'MOVE' && m.hunger > 0.15 ? 'yes' : 'no'} (needs lastAction=MOVE and hunger>0.15).`,
        `Continue consuming? ${orb.lastActionType === 'CONSUME' && m.hunger > 0.05 ? 'yes' : 'no'} (needs lastAction=CONSUME and hunger>0.05).`,
        `Stickiness bonus = ${f(terms.stickiness)}.`,
        ``,
        `The "food attraction" for consuming is: W_hunger * hunger * (healNorm + energyNormHere + stickiness).`,
        `= ${f(W_hunger)} * ${f(m.hunger)} * (${f(terms.gainNorm)} + ${f(frame.currentEnergyNorm)} + ${f(terms.stickiness)})`,
        `= ${f(terms.gain)}.`,
        ``,
        `But I also fear staying here if it's dangerous.`,
        `Fear cost = W_fear * threatHere * effectiveFear = ${f(W_fear)} * ${f(frame.currentThreat)} * ${f(m.fearEffective)} = ${f(terms.fear)}.`,
        ``,
        `Relatives around me give comfort for staying here: kinDrive * kinAffinityHere = ${f(frame.kinDrive)} * ${f(frame.kinDrive > 0 ? terms.kin / frame.kinDrive : 0)} = ${f(terms.kin)}.`,
        `Base score for CONSUME = foodAttraction + kin - fearCost = ${f(terms.gain)} + ${f(terms.kin)} - ${f(terms.fear)} = ${f(base)}.`
      ]

    case 'DIVIDE': {
      const { birthCost } = terms
      return [
        `I consider DIVIDE (make a child near ${here}).`,
        `Can I give birth right now? yes.`,
        `Is there an empty cell next to me (not diagonal) to place a child? yes.`,
        ``,
        `My reproduction desire is ${f(m.reproduction)} and I care with W_reproduction=${f(W_reproduction)}.`,
        `Reproduction bonus = W_reproduction * reproduction = ${f(W_reproduction)} * ${f(m.reproduction)} = ${f(terms.repro)}.`,
        ``,
        `But dividing is scary if the area is dangerous.`,
        `Fear cost = W_fear * threatHere * effectiveFear = ${f(W_fear)} * ${f(frame.currentThreat)} * ${f(m.fearEffective)} = ${f(terms.fear)}.`,
        ``,
        `And dividing makes me pay an hp cost (I invest into the child).`,
        `Offspring investment gene is ${f(genes.offspring_investment)} (fraction of my hp).`,
        `Birth tax is ${frame.birthTaxPercent.toFixed(0)}% of my current hp.`,
        `So total hp cost fraction is ${f(birthCost.costFraction)} (child=${birthCost.childHp}, tax=${birthCost.tax}, total=${birthCost.totalCost}).`,
        `So hunger makes dividing feel more expensive.`,
        `Hunger cost = W_hunger * hunger * totalCostFraction = ${f(W_hunger)} * ${f(m.hunger)} * ${f(birthCost.costFraction)} = ${f(terms.hunger)}.`,
        ``,
        `Relatives around me give comfort for staying here: kinDrive * kinAffinityHere = ${f(frame.kinDrive)} * ${f(frame.kinDrive > 0 ? terms.kin / frame.kinDrive : 0)} = ${f(terms.kin)}.`,
        `Base score for DIVIDE = reproBonus + kin - fearCost - hungerCost = ${f(terms.repro)} + ${f(terms.kin)} - ${f(terms.fear)} - ${f(terms.hunger)} = ${f(base)}.`
      ]
    }

    case 'MOVE': {
      const { cell, seek } = terms
      return [
        `I consider MOVE to ${cell.x},${cell.y} (dx=${cell.dx}, dy=${cell.dy}).`,
        `Is the destination occupied? no.`,
        ``,
        `Food on destination: this cell has ${f(cell.energy)} energy.`,
        `Energy normalized is ${f(terms.energyNorm)} (relative to maxEnergyNorm=${f(genes.max_energy_norm)}).`,
        `My hunger is ${f(m.hunger)} and W_hunger is ${f(W_hunger)}.`,
        `So this cell looks attractive for food by: W_hunger * hunger * energyNorm = ${f(W_hunger)} * ${f(m.hunger)} * ${f(terms.energyNorm)} = ${f(terms.hunger)}.`,
        ...(seek
          ? [
              ``,
              `I also see a "best energy spot" somewhere: ${seek.target.x},${seek.target.y}.`,
              `Its strength (after distance decay) is ${f(seek.target.strength)}.`,
              `If I go to ${cell.x},${cell.y}, my distance to that best spot becomes ${f(seek.newDist)}.`,
              `Right now my distance to that best spot is ${f(seek.target.dist)}.`,
              `Moving toward it by ${f(seek.toward)} gives me a pull of ${f(seek.pull)} (0..1).`,
              `That pull becomes extra motivation: W_hunger * hunger * pull = ${f(W_hunger)} * ${f(m.hunger)} * ${f(seek.pull)} = ${f(terms.seekScore)}.`
            ]
          : []),
        ``,
        `Hunting/attack opportunity: prey score at destination is ${f(cell.prey)}.`,
        `My aggression mood is ${f(m.aggression)} and W_aggression is ${f(W_aggression)}.`,
        `So prey bonus = W_aggression * aggression * prey = ${f(W_aggression)} * ${f(m.aggression)} * ${f(cell.prey)} = ${f(terms.aggro)}.`,
        ``,
        `Comfort/exploration: local density there is ${f(cell.localDensity)}, crowd preference gene is ${f(genes.crowd_preference)}.`,
        `So space preference there is ${f(terms.spacePref)}.`,
        `Exploration mood is ${f(m.exploration)} and W_explore is ${f(W_exploration)}.`,
        `Explore bonus = W_explore * exploration * spacePref = ${f(W_exploration)} * ${f(m.exploration)} * ${f(terms.spacePref)} = ${f(terms.explore)}.`,
        ``,
        `Relatives: kin affinity there is ${f(cell.kinAffinity)}.`,
        `My drive to be near kin is KIN_COMFORT*(1-hunger) + W_fear*effectiveFear = ${f(KIN_COMFORT)}*${f(1 - m.hunger)} + ${f(W_fear)}*${f(m.fearEffective)} = ${f(frame.kinDrive)}.`,
        `So I get a comfort bonus from kin: kinDrive * kinAffinity = ${f(frame.kinDrive)} * ${f(cell.kinAffinity)} = ${f(terms.kin)}.`,
        ``,
        `Fear: threat there is ${f(cell.threat)} and my effective fear is ${f(m.fearEffective)} with W_fear=${f(W_fear)}.`,
        `Fear cost = W_fear * threat * effectiveFear = ${f(W_fear)} * ${f(cell.threat)} * ${f(m.fearEffective)} = ${f(terms.fear)}.`,
        ``,
        `Base score for MOVE = food + seekFood + prey + explore + kin - fear`,
        `= ${f(terms.hunger)} + ${f(terms.seekScore)} + ${f(terms.aggro)} + ${f(terms.explore)} + ${f(terms.kin)} - ${f(terms.fear)} = ${f(base)}.`
      ]
    }

    case 'ATTACK': {
      const { cell, encounter } = terms
      return [
        `I consider ATTACK at ${cell.x},${cell.y} (dx=${cell.dx}, dy=${cell.dy}).`,
        `Is there threat there? yes (threat score=${f(encounter.threat)}).`,
        ``,
        ...explainEncounter(frame, encounter),
        ``,
        `I combine aggression and fear into a "defenseDrive" so I know how much I want to fight back.`,
        `defenseDrive=${f(frame.defenseDrive)} (aggression + fear * defense_instinct).`,
        `Base score for ATTACK = threat * defenseDrive = ${f(encounter.threat)} * ${f(frame.defenseDrive)} = ${f(base)}.`
      ]
    }

    case 'BITE': {
      const { cell, encounter } = terms
      return [
        `I consider BITE at ${cell.x},${cell.y} (dx=${cell.dx}, dy=${cell.dy}).`,
        `Is there prey there? yes (prey score=${f(encounter.prey)}).`,
        `Threat there is ${f(cell.threat)}.`,
        ``,
        ...explainEncounter(frame, encounter),
        ``,
        `I combine hunger and aggression into an "attackDrive" so I know how much I want to bite.`,
        `attackDrive=${f(frame.attackDrive)} (mix of hunger and aggression weights/moods).`,
        `So the main bite drive is: prey * attackDrive = ${f(encounter.prey)} * ${f(frame.attackDrive)} = ${f(terms.preyDrive)}.`,
        ``,
        `I also have a "kill greed" gene that makes me want to attack even beyond pure need.`,
        `kill_greed=${f(genes.kill_greed)} so greed bonus = kill_greed * prey = ${f(genes.kill_greed)} * ${f(encounter.prey)} = ${f(terms.greed)}.`,
        ``,
        `But biting is risky if the area is dangerous.`,
        `Fear cost = W_fear * threat * effectiveFear = ${f(W_fear)} * ${f(cell.threat)} * ${f(m.fearEffective)} = ${f(terms.fear)}.`,
        ``,
        `Base score for BITE = drive + greed - fearCost = ${f(terms.preyDrive)} + ${f(terms.greed)} - ${f(terms.fear)} = ${f(base)}.`
      ]
    }
  }
}

function explainScore(frame: DecisionFrame, candidate: Candidate): string[] {
  const { orb } = frame
  const { genes } = orb
  const { base, inertia, noise, final } = candidate.score!
  return [
    ``,
    `Now I turn this base score into a final score (because I'm not perfectly rational).`,
    `Base score = ${f(base)}.`,
    `My inertia_bias gene is ${f(genes.inertia_bias)}. My last action was ${orb.lastActionKey ?? 'none'}.`,
    inertia > 0
      ? `This repeats my last action, so it gets a bonus: inertia_bias * ${f(INERTIA_BONUS)} = ${f(inertia)}.`
      : `This does not repeat my last action, so it gets no inertia bonus.`,
    `Then I add randomness: decision_noise gene is ${f(genes.decision_noise)}.`,
    `Random noise sampled this turn is ${f(noise)}.`,
    `Final score = base + inertia + noise = ${f(base)} + ${f(inertia)} + ${f(noise)} = ${f(final)}.`
  ]
}

/** Where the candidate points: the target cell and, for directed actions, the step towards it. */
function describeTarget(frame: DecisionFrame, candidate: Candidate): { target: string; direction: string; delta: string } {
  const { orb } = frame
  const { type, targetX, targetY } = candidate.decision
  if (type === 'DIVIDE') {
    return { target: `near ${orb.x},${orb.y}`, direction: '', delta: '' }
  }
  const x = targetX ?? orb.x
  const y = targetY ?? orb.y
  const dx = x - orb.x
  const dy = y - orb.y
  const direction = directionFromDelta(dx, dy)
  const offset = dx === 0 && dy === 0 ? '' : ` (dx=${dx},dy=${dy})`
  return { target: `${x},${y}${offset}`, direction, delta: ` (${direction}, dx=${dx}, dy=${dy})` }
}

export function logDecisionTrace(frame: DecisionFrame, candidates: Candidate[], outcome: Outcome) {
  const { orb, motivations: m } = frame
  const { genes } = orb

  console.groupCollapsed(
    `Decision: ${orb.name} age=${orb.age} hp=${orb.hp.toFixed(2)} @${orb.x},${orb.y}${outcome.impulsive ? ' (impulsive)' : ''}`
  )

  console.log('My motivations:')
  console.table({
    id: orb.id,
    hpNorm: round3(m.hpNorm),
    hunger: round3(m.hunger),
    fear: round3(m.fear),
    fearEffective: round3(m.fearEffective),
    aggression: round3(m.aggression),
    reproduction: round3(m.reproduction),
    exploration: round3(m.exploration)
  })
  console.log('My gene motivation weights:')
  console.table({
    W_hunger: round3(genes.hunger_weight),
    W_aggression: round3(genes.aggression_weight),
    W_exploration: round3(genes.exploration_weight),
    W_fear: round3(genes.fear_weight),
    W_reproduction: round3(genes.reproduction_weight)
  })
  console.log('My gene decision modifiers:')
  console.table({
    inertia_bias: round3(genes.inertia_bias),
    decision_noise: round3(genes.decision_noise),
    impulsiveness: round3(genes.impulsiveness),
    trust_in_relatives: round3(genes.trust_in_relatives),
    aggression_towards_relatives: round3(genes.aggression_towards_relatives)
  })
  console.log('My situation:')
  console.table({
    currentEnergy: round3(frame.currentEnergy),
    currentEnergyNorm: round3(frame.currentEnergyNorm),
    currentThreat: round3(frame.currentThreat),
    currentLocalDensity: round3(frame.currentLocalDensity),
    spacePrefCurrent: round3(frame.spacePrefCurrent),
    lastAction: orb.lastActionKey ?? ''
  })

  const rolls = `impulsiveRoll=${f(outcome.impulsiveRoll)}`
  console.log(outcome.pickRoll === null ? rolls : `${rolls} pickRoll=${f(outcome.pickRoll)}`)

  console.table(
    candidates.map(candidate => {
      const { target, direction } = describeTarget(frame, candidate)
      const score = candidate.score!
      return {
        type: candidate.decision.type,
        target,
        direction,
        base: round3(score.base),
        inertia: round3(score.inertia),
        noise: round3(score.noise),
        final: round3(score.final)
      }
    })
  )

  for (const candidate of candidates) {
    const { target, delta } = describeTarget(frame, candidate)
    console.groupCollapsed(`${candidate.decision.type} to ${target}${delta}`)
    const lines = [
      ...explainTerms(frame, candidate.terms!, candidate.score!.base),
      ...explainScore(frame, candidate)
    ]
    for (const line of lines) {
      console.log(line.length === 0 ? '' : `  ${line}`)
    }
    console.groupEnd()
  }

  const { picked } = outcome
  const pickedTarget = describeTarget(frame, picked)
  const pickedDirection = pickedTarget.direction && pickedTarget.direction !== 'here' ? ` (${pickedTarget.direction})` : ''
  console.log(
    `${outcome.impulsive ? 'picked' : 'best'}: ${picked.decision.type} to ${pickedTarget.target}${pickedDirection} ` +
      `(${picked.decision.description}) u=${f(picked.decision.utility)}`
  )
  console.groupEnd()
}
