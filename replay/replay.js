const fixtureUri = (fixtureId) => `https://apiv2.cricket.com.au/web/views/scorecard?fixtureId=${fixtureId}&jsconfig=eccn%3Atrue&format=json`
const ballsUri = (fixtureId, inningNumber) => `https://apiv2.cricket.com.au/web/views/comments?fixtureId=${fixtureId}&inningNumber=${inningNumber}&jsconfig=eccn%3Atrue&format=json`

let fixtureData
let oversData
let teams
let players
let inningsTab
let cursors

async function loadData(fixtureId) {
  const fixture = await fetch(fixtureUri(fixtureId))
  fixtureData = await fixture.json()
  inningsTab = 0
  oversData = []
  cursors = []
  for (let innings = 0; innings < fixtureData.fixture.innings.length; innings++) {
    inningsOvers = await loadInningsData(ballsUri(fixtureId, innings + 1), null)
    oversData.push(inningsOvers)
    cursors.push({over: 1, ball: 0})
  }

  teams = new Map()
  teams.set(fixtureData.fixture.homeTeam.id, fixtureData.fixture.homeTeam)
  teams.set(fixtureData.fixture.awayTeam.id, fixtureData.fixture.awayTeam)
  players = new Map()
  fixtureData.players.forEach((player) => {
    players.set(player.id, player)
  })

}

async function loadInningsData(uri, acc) {
  const response = await fetch(uri)
  const innings = await response.json()
  const overs = innings.inning.overs.reverse()
  // Remove fake over zero
  if (overs[0].overNumber === 0) {
    overs.shift()
  }
  overs.forEach((over) => (
    over.balls = over.balls.reverse()
  ))
  if (acc === null) {
    acc = innings.inning
  } else {
    acc.overs = overs.concat(acc.overs)
  }
  if (overs[0].overNumber > 1) {
    console.log("Loading next page: ", innings.nextPage)
    const nextPage = "https://apiv2.cricket.com.au/web" + innings.nextPage
    return await loadInningsData(nextPage, acc)
  } else {
    return acc
  }
}

class Dismissal {
  constructor(ball) {
    this.playerId = ball.dismissalPlayerId
    this.bowlerId = ball.bowlerPlayerId
    this.dismissalType = ball.dismissalTypeId
  }
}

class BatterScore {
  constructor(player) {
    this.player = player
    this.runs = 0
    this.balls = 0
    this.out = false
  }

  get id() {
    return this.player.playerId
  }

  addBall(ball) {
    this.runs += ball.runsScored
    const typeId = ball.comments[0].commentTypeId
    if (typeId === 'Wide' || typeId === 'NoBall') {
      // Does not count as a ball
    } else {
      this.balls++
    }

    if (ball.isWicket) {
      this.out = true
    }
  }

  get dismissalText() {
    if (this.out) {
      return this.player.dismissalText
    } else if (this.balls > 0) {
      return 'not out'
    } else {
      return null
    }
  }

  get runsText() {
    if (!this.out && this.balls > 0) {
      return `${this.runs}*`
    } else {
      return this.runs.toString()
    }
  }
}

class BowlerScore {
  constructor(player) {
    this.player = player
    this.balls = 0
    this.runs = 0
    this.wides = 0
    this.noBalls = 0
    this.wickets = []
  }

  get id() {
    return this.player.playerId
  }

  addBall(ball) {
    this.runs += ball.runsConceded

    const typeId = ball.comments[0].commentTypeId
    if (typeId === 'Wide') {
      this.wides++
    } else if (typeId === 'NoBall') {
      this.noBalls++
    } else {
      this.balls++
    }

    if (ball.isWicket) {
      this.wickets.push(new Dismissal(ball))
    }
  }

  get overs() {
    if (this.balls % 6 === 0) {
      return Math.floor(this.balls / 6).toString()
    } else {
      return `${Math.floor(this.balls / 6)}.${this.balls % 6}`
    }
  }
}

class Scorecard {
  constructor(fixtureInnings) {
    this.innings = fixtureInnings
    this.batters = this.innings.batsmen.map((x) => new BatterScore(x))
    this.bowlers = this.innings.bowlers.map((x) => new BowlerScore(x))
    this.runs = 0
    this.wickets = 0
    this.started = false
  }

  addBall(ball) {
    console.log(ball)
    this.started = true
    this.batters.forEach((batter) => {
      if (batter.id == ball.battingPlayerId) {
        batter.addBall(ball)
      }
    })
    this.bowlers.forEach((bowler) => {
      if (bowler.id == ball.bowlerPlayerId) {
        bowler.addBall(ball)
      }
    })
    this.runs += ball.runs
    if (ball.isWicket) {
      this.wickets += 1
    }
  }

  scoreString() {
    if (this.wickets < 10) {
      return `${this.wickets}-${this.runs}`
    } else {
      return this.runs.toString()
    }
  }
}

function generateScorecard(innings) {
  const cursor = cursors[innings]
  console.log(cursor)
  const scorecard = new Scorecard(fixtureData.fixture.innings[innings])
  for (let over = 0; over < cursor.over; over++) {
    const ballCount = over === cursor.over - 1 ? cursor.ball : oversData[innings].overs[over].balls.length
    for (let ball = 0; ball < ballCount; ball++) {
      scorecard.addBall(oversData[innings].overs[over].balls[ball])
    }
  }
  return scorecard
}

function renderAll() {
  const scorecards = []
  for (let i = 0; i < oversData.length; i ++) {
    scorecards.push(generateScorecard(i))
  }
  console.log(scorecards)
  renderHero()
  renderInningsTabs(scorecards)
  renderBatterScorecard(scorecards[inningsTab])
  renderBowlerScorecard(scorecards[inningsTab])
  renderCursorForm()
}

function renderBatterScorecard(scorecard) {
  const element = document.getElementById("batter-scorecard")
  element.innerHTML = ''
  scorecard.batters.forEach((batter) => {
    const row = document.createElement("tr")
    const name = document.createElement("td")
    name.textContent = players.get(batter.id).displayName
    row.appendChild(name)
    const wicket = document.createElement("td")
    wicket.textContent = batter.dismissalText
    row.appendChild(wicket)
    const runs = document.createElement("td")
    runs.textContent = batter.runsText
    row.appendChild(runs)
    const balls = document.createElement("td")
    balls.textContent = batter.balls
    row.appendChild(balls)
    element.appendChild(row)
  })
}

function renderBowlerScorecard(scorecard) {
  const element = document.getElementById("bowler-scorecard")
  element.innerHTML = ''
  scorecard.bowlers.forEach((bowler) => {
    const row = document.createElement("tr")
    const name = document.createElement("td")
    name.textContent = players.get(bowler.id).displayName
    row.appendChild(name)
    const overs = document.createElement("td")
    overs.textContent = bowler.overs
    row.appendChild(overs)
    const runs = document.createElement("td")
    runs.textContent = bowler.runs
    row.appendChild(runs)
    const wickets = document.createElement("td")
    wickets.textContent = bowler.wickets.length
    row.appendChild(wickets)
    const wides = document.createElement("td")
    wides.textContent = bowler.wides
    row.appendChild(wides)
    const noBalls = document.createElement("td")
    noBalls.textContent = bowler.noBalls
    row.appendChild(noBalls)
    element.appendChild(row)
  })
}

function scoreString(innings) {
  const runs = innings.runsScored
  const wickets = innings.numberOfWicketsFallen

  if (innings.isDeclared) {
    return `${wickets}d-${runs}`
  } else if (wickets < 10) {
    return `${wickets}-${runs}`
  } else {
    return runs.toString()
  }
}

function renderInningsTabs(scorecards) {
  for (let i = 0; i < oversData.length; i++) {
    const tab = document.getElementById(`innings-tab-${i}`)
    const team = teams.get(oversData[i].battingTeamId).shortName
    if (i === inningsTab) {
      tab.classList.add("is-active")
    } else {
      tab.classList.remove("is-active")
    }
    if (scorecards[i].started) {
      tab.firstChild.textContent = `${team} ${scorecards[i].scoreString()}`
    } else {
      tab.firstChild.textContent = team
    }
  }
}

function renderHero() {
  document.getElementById("homeTeam").innerHTML = fixtureData.fixture.homeTeam.name
  document.getElementById("awayTeam").innerHTML = fixtureData.fixture.awayTeam.name
  document.getElementById("format").innerHTML = fixtureData.fixture.gameType
  document.getElementById("date").innerHTML = new Date(fixtureData.fixture.startDateTime).toDateString()
}

function renderCursorForm() {
  document.getElementById("over").value = cursors[inningsTab].over
  document.getElementById("ball").value = cursors[inningsTab].ball
}

function incrementCursor(innings) {
  const cursor = cursors[innings]
  if (cursor.ball < oversData[innings].overs[cursor.over].balls.length - 1) {
    cursor.ball++
  } else if (cursor.over < oversData[innings].overs.length - 1) {
    cursor.over++
    cursor.ball = 0
  }
}

function decrementCursor(innings) {
  const cursor = cursors[innings]
  if (cursor.ball > 0) {
    cursor.ball--
  } else if (cursor.over > 0) {
    cursor.over--
    cursor.ball = oversData[innings].overs[cursor.over].balls.length - 1
  }
}

function updateOnClick() {
  cursors[inningsTab] = {
    over: parseInt(document.getElementById("over").value),
    ball: parseInt(document.getElementById("ball").value)
  }
  renderAll()
}

function nextOnClick() {
  incrementCursor(inningsTab)
  renderAll()
}

function previousOnClick() {
  decrementCursor(inningsTab)
  renderAll()
}

function setInnings(innings) {
  inningsTab = innings
  renderAll()
}

async function onLoad() {
  console.log("hi")
  const fixtureId = 17404
  await loadData(fixtureId)
  renderAll()
  console.log("end on load")
}

document.addEventListener('DOMContentLoaded', onLoad)