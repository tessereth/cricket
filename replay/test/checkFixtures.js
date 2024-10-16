import { readdir, readFile } from "node:fs/promises"
import { fixtureData, oversData, State } from "../replay.js"

async function main() {
  const dir = `${import.meta.dirname}/data`
  const files = await readdir(dir)
  for (const fixtureId of files) {
    console.log(`Checking fixture ${fixtureId}`)
    await loadData(fixtureId)
    checkScorecards()
  }
}

async function loadData(fixtureId) {
  const dir = `${import.meta.dirname}/data/${fixtureId}`

  const storedFixture = JSON.parse(await readFile(`${dir}/fixture.json`))
  const storedOvers = JSON.parse(await readFile(`${dir}/overs.json`))

  // We can't assign to fixtureData or oversData so we modify them in place
  Object.assign(fixtureData, storedFixture)
  oversData.length = 0
  oversData.push(...storedOvers)
}

function checkScorecards() {
  const state = new State()
  for (let i = 0; i < oversData.length; i++) {
    state.setCursorEnd(i)
    const scorecard = state.generateScorecard(i)
    const innings = fixtureData.fixture.innings[i]

    checkBatters(innings.batsmen, scorecard.batters)
    checkBowlers(innings.bowlers, scorecard.bowlers)
  }
}

function checkBatters(realBatters, simulatedBatters) {
  if (realBatters.length !== simulatedBatters.length) {
    console.error("Mismatched number of batters")
    process.exit(1)
  }
  for (let j = 0; j < realBatters.length; j++) {
    const realBatter = realBatters[j]
    const simulatedBatter = simulatedBatters[j]

    if (realBatter.playerId !== simulatedBatter.id ||
      realBatter.ballsFaced !== simulatedBatter.balls ||
      (realBatter.runsScored || 0) !== simulatedBatter.runs ||
      realBatter.isOut !== simulatedBatter.out
    ) {
      console.error("Batter mismatch", realBatter, simulatedBatter)
      process.exit(1)
    } else {
      console.log("Batter match: ", realBatter.playerId)
    }
  }

}

function checkBowlers(realBowlers, simulatedBowlers) {
  if (realBowlers.length !== simulatedBowlers.length) {
    console.error("Mismatched number of bowlers")
    process.exit(1)
  }

  for (let j = 0; j < realBowlers.length; j++) {
    const realBowler = realBowlers[j]
    const simulatedBowler = simulatedBowlers[j]

    if (realBowler.playerId !== simulatedBowler.id ||
      realBowler.totalBallsBowled !== simulatedBowler.balls ||
      (realBowler.runsConceded || 0) !== simulatedBowler.runs ||
      realBowler.wicketsTaken !== simulatedBowler.wickets ||
      realBowler.wideBalls !== simulatedBowler.wides ||
      realBowler.noBalls !== simulatedBowler.noBalls
    ) {
      console.error("Bowler mismatch", realBowler, simulatedBowler)
      process.exit(1)
    } else {
      console.log("Bowler match: ", realBowler.playerId)
    }
  }
}

await main()