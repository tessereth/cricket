const fixtureUri = (fixtureId) => `https://apiv2.cricket.com.au/web/views/scorecard?fixtureId=${fixtureId}&jsconfig=eccn%3Atrue&format=json`
const ballsUri = (fixtureId, inningNumber) => `https://apiv2.cricket.com.au/web/views/comments?fixtureId=${fixtureId}&inningNumber=${inningNumber}&jsconfig=eccn%3Atrue&format=json`

// routing
let inningsTab

// API data
let fixtureData
let oversData
let teams
let players

class State {
  constructor() {
    this.loading = true
    this.cursors = Array.from({ length: 4 }, () => ({ over: 0, ball: 0 }));
  }

  loaded() {
    this.loading = false
  }

  cursor(innings) {
    return this.cursors[innings]
  }

  setCursor(innings, over, ball) {
    this.cursors[innings] = { over, ball }
  }

  incrementCursor(innings) {
    const cursor = this.cursors[innings]
    if (cursor.over >= oversData[innings].overs.length) {
      // We've reached the end, do nothing
    } else if (cursor.ball < oversData[innings].overs[cursor.over].balls.length - 1) {
      cursor.ball++
    } else {
      cursor.over++
      cursor.ball = 0
    }
  }

  decrementCursor(innings) {
    const cursor = this.cursors[innings]
    if (cursor.ball > 0) {
      cursor.ball--
    } else if (cursor.over > 0) {
      cursor.over--
      cursor.ball = oversData[innings].overs[cursor.over].balls.length - 1
    }
  }
}

let state = new State()

function params() {
  return new URLSearchParams(window.location.search)
}

function fixtureId() {
  return params().get("fixture") || 17404
}

async function loadData(fixtureId) {
  oversData = []
  const fixture = await fetch(fixtureUri(fixtureId))
  fixtureData = await fixture.json()

  teams = new Map()
  teams.set(fixtureData.fixture.homeTeam.id, fixtureData.fixture.homeTeam)
  teams.set(fixtureData.fixture.awayTeam.id, fixtureData.fixture.awayTeam)
  players = new Map()
  fixtureData.players.forEach((player) => {
    players.set(player.id, player)
  })
}

async function loadBallData(fixtureId) {
  for (let innings = 0; innings < fixtureData.fixture.innings.length; innings++) {
    inningsOvers = await loadPaginatedBallData(ballsUri(fixtureId, innings + 1), null)
    oversData.push(inningsOvers)
  }
}

async function loadPaginatedBallData(uri, acc) {
  const response = await fetch(uri)
  const innings = await response.json()
  if (innings.inning.overs.length === 0) {
    // Overs data not available
    return
  }

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
    return await loadPaginatedBallData(nextPage, acc)
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
    if (this.balls === 0) {
      return ''
    } else if (!this.out) {
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
    if (!lastBall) {
      return "0.0"
    } else if (lastBall.isLastBallOfOver) {
      return `${this.currentOver + 1}.0`
    } else if (lastBall.isIllegalDelivery) {
      return `${this.currentOver}.${lastBall.ballNumber - 1}`
    } else {
      return `${this.currentOver}.${lastBall.ballNumber}`
    }
  }
}

function generateScorecard(innings) {
  const scorecard = new Scorecard(fixtureData.fixture.innings[innings])
  if (!oversData[innings]) {
    // We don't have ball data, use an empty scorecard
    return scorecard
  }
  const cursor = state.cursor(innings)
  for (let over = 0; over <= cursor.over; over++) {
    const ballCount = over === cursor.over ? cursor.ball : oversData[innings].overs[over].balls.length
    for (let ball = 0; ball < ballCount; ball++) {
      scorecard.addBall(over, new Ball(oversData[innings].overs[over].balls[ball]))
    }
  }
  return scorecard
}

function renderAll() {
  const scorecards = []
  for (let i = 0; i < fixtureData.fixture.innings.length; i++) {
    scorecards.push(generateScorecard(i))
  }
  console.log(scorecards)
  renderHero()
  renderMessage()
  renderInningsTabs(scorecards)
  renderBallByBall(scorecards[inningsTab])
  renderBatterScorecard(scorecards[inningsTab])
  renderBowlerScorecard(scorecards[inningsTab])
}

function renderBallByBall(scorecard) {
  const element = document.getElementById("ball-by-ball")
  const children = []
  scorecard.balls.forEach((ball) => {
    let text
    if (ball.isWicket) {
      text = 'W'
    } else if (ball.type === 'Wide') {
      text = 'w'
    } else if (ball.type === 'NoBall') {
      text = 'nb'
    } else if (ball.type === 'LegBye') {
      text = `${ball.runs}lb`
    } else if (ball.runs === 0) {
      text = '⏺'
    } else {
      text = ball.runs
    }
    children.push(createElement("span", text, ["icon", "ml-4"]))
    if (ball.isLastBallOfOver) {
      children.push(createElement("span", "|", ["icon", "ml-4"]))
    }
  })
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
    row.appendChild(createElement("td", batter.balls > 0 ? batter.balls : ''))
    rows.push(row)
  })
  element.replaceChildren(...rows)
}

function renderBowlerScorecard(scorecard) {
  const element = document.getElementById("bowler-scorecard")
  const rows = []
  scorecard.bowlers.forEach((bowler) => {
    if (bowler.balls === 0) {
      return
    }
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
  const element = document.getElementById("innings-tabs")
  const list = element.querySelector("ul")
  list.innerHTML = ''
  const template = element.querySelector("template").content
  for (let i = 0; i < scorecards.length; i++) {
    const tab = document.importNode(template, true)
    tab.querySelector("[data-team]").textContent = teams.get(fixtureData.fixture.innings[i].battingTeamId).shortName
    tab.querySelector("[data-score]").textContent = scorecards[i].scoreString()
    tab.querySelector("[data-overs]").textContent = `(${scorecards[i].overString()})`
    const link = tab.querySelector("[data-link]")
    const linkParams = params()
    linkParams.set("innings", i)
    link.href = `?${linkParams}`
    link.addEventListener('click', (e) => {
      e.preventDefault()
      setInnings(i)
    })


    if (i === inningsTab) {
      tab.querySelector("li").classList.add("is-active")
    }
    list.appendChild(tab)
  }
}

function renderHero() {
  const fixture = fixtureData.fixture
  document.querySelector("[data-competition-image]").src = fixture.competition.imageUrl
  document.querySelector("[data-home-team]").textContent = fixture.homeTeam.name
  document.querySelector("[data-home-team-image]").src = fixture.homeTeam.logoUrl
  document.querySelector("[data-away-team]").textContent = fixture.awayTeam.name
  document.querySelector("[data-away-team-image]").src = fixture.awayTeam.logoUrl
  document.querySelector("[data-date]").textContent = formatDate(fixture.startDateTime, fixture.endDateTime)
  document.querySelector("[data-game-type]").textContent = fixture.gameType
}

function renderMessage() {
  const loadingIndicator = document.querySelector("[data-loading]")
  const noReplay = document.querySelector("[data-no-replay-message]")
  if (state.loading) {
    loadingIndicator.classList.remove("is-hidden")
    noReplay.classList.add("is-hidden")
  } else if (!oversData[0]) {
    loadingIndicator.classList.add("is-hidden")
    noReplay.classList.remove("is-hidden")
  } else {
    loadingIndicator.classList.add("is-hidden")
    noReplay.classList.add("is-hidden")
  }
}

function updateOnClick() {
  const over = parseInt(document.getElementById("over").value)
  const ball = parseInt(document.getElementById("ball").value || '0')
  state.setCursor(inningsTab, over, ball)
  renderAll()
}

function nextOnClick() {
  state.incrementCursor(inningsTab)
  renderAll()
}

function previousOnClick() {
  state.decrementCursor(inningsTab)
  renderAll()
}

function firstOnClick() {
  state.setCursor(inningsTab, 0, 0)
  renderAll()
}

function lastOnClick() {
  const over = oversData[inningsTab].overs.length - 1
  const ball = oversData[inningsTab].overs.slice(-1)[0].balls.length
  state.setCursor(inningsTab, over, ball)
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

  inningsTab = params().get("innings") || 0
  await loadData(fixtureId())
  // Render what we can before loading the ball data
  renderAll()
  await loadBallData(fixtureId())
  state.loaded()

  // Render the final version
  renderAll()
  console.log("data loaded")
}

document.addEventListener('DOMContentLoaded', onLoad)
document.addEventListener('keydown', onKeyDown)
