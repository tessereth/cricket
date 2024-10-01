const fixtureUri = (fixtureId) => `https://apiv2.cricket.com.au/web/views/scorecard?fixtureId=${fixtureId}&jsconfig=eccn%3Atrue&format=json`
const ballsUri = (fixtureId, inningNumber) => `https://apiv2.cricket.com.au/web/views/comments?fixtureId=${fixtureId}&inningNumber=${inningNumber}&jsconfig=eccn%3Atrue&format=json`

let fixtureData;
let oversData;
let players;

async function loadData(fixtureId) {
  const fixture = await fetch(fixtureUri(fixtureId))
  fixtureData = await fixture.json()
  oversData = []
  // TODO: more than 2 innings
  for (let innings = 1; innings <= 2; innings++) {
    inningsOvers = await loadBallData(ballsUri(fixtureId, innings), [])
    // Remove fake over zero
    if (inningsOvers[0].overNumber === 0) {
      inningsOvers.shift()
    }
    oversData.push(inningsOvers)
  }

  players = new Map()
  fixtureData.players.forEach((player) => {
    players.set(player.id, player)
  })
}

async function loadBallData(uri, acc) {
  const balls = await fetch(uri)
  const data = await balls.json()
  const overs = data.inning.overs.reverse()
  overs.forEach((over) => (
    over.balls = over.balls.reverse()
  ))
  if (overs[0].overNumber > 1) {
    console.log("Loading next page: ", data.nextPage)
    const nextPage = "https://apiv2.cricket.com.au/web" + data.nextPage
    return await loadBallData(nextPage, overs.concat(acc))
  } else {
    return overs.concat(acc)
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
    return `${Math.floor(this.balls / 6)}.${this.balls % 6}`
  }
}

class Scorecard {
  constructor(fixtureInnings) {
    this.innings = fixtureInnings
    this.batters = this.innings.batsmen.map((x) => new BatterScore(x))
    this.bowlers = this.innings.bowlers.map((x) => new BowlerScore(x))
    this.runs = 0
    this.wickets = 0
  }

  addBall(ball) {
    console.log(ball)
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
}

function generateScorecard(cursor) {
  console.log(cursor)
  const scorecard = new Scorecard(fixtureData.fixture.innings[cursor.innings])
  for (let over = 0; over < cursor.over; over++) {
    const ballCount = over === cursor.over - 1 ? cursor.ball : oversData[cursor.innings][over].balls.length
    for (let ball = 0; ball < ballCount; ball++) {
      scorecard.addBall(oversData[cursor.innings][over].balls[ball])
    }
  }
  return scorecard
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

function getCursor() {
  return {
    innings: parseInt(document.getElementById("innings").value),
    over: parseInt(document.getElementById("over").value),
    ball: parseInt(document.getElementById("ball").value) 
  }
}

function setCursor(cursor) {
  document.getElementById("innings").value = cursor.innings
  document.getElementById("over").value = cursor.over
  document.getElementById("ball").value = cursor.ball
}

function updateOnClick() {
  const scorecard = generateScorecard(getCursor())
  console.log(scorecard)
  renderBatterScorecard(scorecard)
  renderBowlerScorecard(scorecard)
}

function nextOnClick() {
  const cursor = getCursor()
  if (cursor.ball < oversData[cursor.innings][cursor.over - 1].balls.length - 1) {
    setCursor({...cursor, ball: cursor.ball + 1})
  } else if (cursor.over < oversData[cursor.innings].length - 1) {
    setCursor({...cursor, over: cursor.over + 1, ball: 0})
  }
  updateOnClick()
}

function previousOnClick() {
  const cursor = getCursor()
  if (cursor.ball > 0) {
    setCursor({...cursor, ball: cursor.ball - 1})
  } else if (cursor.over > 0) {
    setCursor({...cursor, over: cursor.over - 1, ball: oversData[cursor.innings][cursor.over - 1].balls.length})
  }
  updateOnClick()
}

let liveData = {
  homeTeam: "",
  awayTeam: "",
  format: "",
  date: "",
}

function updateUI() {
  document.getElementById("homeTeam").innerHTML = liveData.homeTeam
  document.getElementById("awayTeam").innerHTML = liveData.awayTeam
  document.getElementById("format").innerHTML = liveData.format
  document.getElementById("date").innerHTML = liveData.date
}

async function onLoad() {
  console.log("hi")
  const fixtureId = 17404
  await loadData(fixtureId)
  liveData.homeTeam = fixtureData.fixture.homeTeam.name
  liveData.awayTeam = fixtureData.fixture.awayTeam.name
  liveData.format = fixtureData.fixture.gameType
  liveData.date = new Date(fixtureData.fixture.startDateTime).toDateString()
  updateUI()
  updateOnClick()
  console.log("end on load")
}

document.addEventListener('DOMContentLoaded', onLoad)