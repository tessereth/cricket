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
    const nextPage = "https://apiv2.cricket.com.au/web" + innings.nextPage
    return await loadInningsData(nextPage, acc)
  } else {
    return acc
  }
}

class Ball {
  constructor(ballJson) {
    this.ballJson = ballJson
  }

  get battingPlayerId() {
    return this.ballJson.battingPlayerId
  }

  get bowlerPlayerId() {
    return this.ballJson.bowlerPlayerId
  }

  get runs() {
    return this.ballJson.runs
  }

  get runsScored() {
    return this.ballJson.runsScored
  }

  get runsConceded() {
    return this.ballJson.runsConceded
  }

  get isWicket() {
    return this.ballJson.isWicket
  }

  get ballNumber() {
    return this.ballJson.ballNumber
  }

  get type() {
    return this.ballJson.comments[0].commentTypeId
  }

  get isIllegalDelivery() {
    return this.type === 'Wide' || this.type === 'NoBall'
  }

  get isLastBallOfOver() {
    return this.ballJson.ballNumber === 6 && !this.isIllegalDelivery
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
    if (!ball.isIllegalDelivery) {
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
    this.wickets = 0
  }

  get id() {
    return this.player.playerId
  }

  addBall(ball) {
    this.runs += ball.runsConceded

    if (ball.type === 'Wide') {
      this.wides++
    } else if (ball.type === 'NoBall') {
      this.noBalls++
    } else {
      this.balls++
    }

    if (ball.isWicket) {
      this.wickets++
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
    this.currentOver = 0
    this.balls = []
  }

  addBall(over, ball) {
    this.currentOver = over
    this.balls.push(ball)
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

  overString() {
    const lastBall = this.balls.slice(-1)[0]
    if (lastBall.isLastBallOfOver) {
      return `${this.currentOver + 1}.0`
    } else {
      return `${this.currentOver}.${lastBall.ballNumber}`
    }
  }
}

function generateScorecard(innings) {
  const cursor = cursors[innings]
  const scorecard = new Scorecard(fixtureData.fixture.innings[innings])
  for (let over = 0; over < cursor.over; over++) {
    const ballCount = over === cursor.over - 1 ? cursor.ball : oversData[innings].overs[over].balls.length
    for (let ball = 0; ball < ballCount; ball++) {
      scorecard.addBall(over, new Ball(oversData[innings].overs[over].balls[ball]))
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
  renderBallByBall(scorecards[inningsTab])
  renderBatterScorecard(scorecards[inningsTab])
  renderBowlerScorecard(scorecards[inningsTab])
}

function createElement(tag, content, className=null) {
  const elem = document.createElement(tag)
  elem.textContent = content
  if (className) {
    elem.classList.add(className)
  }
  return elem
}

function renderBallByBall(scorecard) {
  const element = document.getElementById("ball-by-ball")
  const children = []
  scorecard.balls.slice(-12).forEach((ball) => {
    let text
    if (ball.isWicket) {
      text = 'W'
    } else if (ball.type === 'Wide') {
      text = 'w'
    } else if (ball.type === 'NoBall') {
      text = 'nb'
    } else if (ball.runs === 0) {
      text = '⏺'
    } else {
      text = ball.runs
    }
    children.push(createElement("span", text, "icon"))
    if (ball.isLastBallOfOver) {
      children.push(createElement("span", "|", "icon"))
    }
  })
  // Pad out the left with &nbsp; if needed
  for (let i = children.length; i < 14; i ++) {
    children.unshift(createElement("span", " ", "icon"))
  }
  element.replaceChildren(...children)
}

function renderBatterScorecard(scorecard) {
  const element = document.getElementById("batter-scorecard")
  const rows = []
  scorecard.batters.forEach((batter) => {
    const row = document.createElement("tr")
    row.appendChild(createElement("td", players.get(batter.id).displayName))
    row.appendChild(createElement("td", batter.dismissalText))
    row.appendChild(createElement("td", batter.runsText))
    row.appendChild(createElement("td", batter.balls))
    rows.push(row)
  })
  element.replaceChildren(...rows)
}

function renderBowlerScorecard(scorecard) {
  const element = document.getElementById("bowler-scorecard")
  const rows = []
  scorecard.bowlers.forEach((bowler) => {
    const row = document.createElement("tr")
    row.appendChild(createElement("td", players.get(bowler.id).displayName))
    row.appendChild(createElement("td", bowler.overs))
    row.appendChild(createElement("td", bowler.runs))
    row.appendChild(createElement("td", bowler.wickets))
    row.appendChild(createElement("td", bowler.wides))
    row.appendChild(createElement("td", bowler.noBalls))
    rows.push(row)
  })
  element.replaceChildren(...rows)
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
    if (scorecards[i].balls.length > 0) {
      tab.firstChild.textContent = `${team} ${scorecards[i].scoreString()} ${scorecards[i].overString()}`
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

function incrementCursor(innings) {
  const cursor = cursors[innings]
  if (cursor.ball < oversData[innings].overs[cursor.over - 1].balls.length - 1) {
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
    cursor.ball = oversData[innings].overs[cursor.over - 1].balls.length - 1
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

function firstOnClick() {
  cursors[inningsTab] = {over: 1, ball: 0}
  renderAll()
}

function lastOnClick() {
  cursors[inningsTab] = {
    over: oversData[inningsTab].overs.length,
    ball: oversData[inningsTab].overs.slice(-1)[0].balls.length
  }
  renderAll()
}

function onKeyDown(event) {
  if (event.key === "ArrowLeft") {
    previousOnClick()
  } else if (event.key === "ArrowRight") {
    nextOnClick()
  }
}

function setInnings(innings) {
  inningsTab = innings
  renderAll()
}

async function onLoad() {
  console.log("starting data load")
  const fixtureId = 17404
  await loadData(fixtureId)
  renderAll()
  console.log("data loaded")
}

document.addEventListener('DOMContentLoaded', onLoad)
document.addEventListener('keydown', onKeyDown)
