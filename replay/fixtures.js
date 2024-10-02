const fixturesUri = 'https://apiv2.cricket.com.au/web/views/fixtures?jsconfig=eccn%3Atrue&format=json'

async function getFixtures(params) {
  const uri = URL.parse(fixturesUri)
  uri.searchParams.set('CompletedFixturesCount', 10)

  const response = await fetch(uri.href)
  const data = await response.json()
  return data.completedFixtures
}

function month(date) {
  return new Intl.DateTimeFormat('en', {month: 'short'}).format(date)
}

function formatDate(startDateStr, endDateStr) {
  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  const hoursMinutes = new Intl.DateTimeFormat('en', {hour: '2-digit', minute: '2-digit'}).format(startDate)
  let day
  if (startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate()) {
    day = `${startDate.getDate()} ${month(startDate)} ${startDate.getFullYear()}`
  } else if (startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth()) {
    day = `${startDate.getDate()}-${endDate.getDate()} ${month(startDate)} ${startDate.getFullYear()}`
  } else if (startDate.getFullYear() === endDate.getFullYear()) {
    day = `${startDate.getDate()} ${month(startDate)} - ${endDate.getDate()} ${month(endDate)} ${startDate.getFullYear()}`
  } else {
    day = `${startDate.getDate()} ${month(startDate)} ${startDate.getFullYear()} - ${endDate.getDate()} ${month(endDate)} ${endDate.getFullYear()}`
  }
  return `${day} · ${hoursMinutes}`
}

function createCard(fixture) {
  const template = document.getElementById("fixture-template").content
  const card = document.importNode(template, true)
  card.querySelectorAll("[data-replay-link]")[0].href = `replay.html?fixture=${fixture.id}`
  card.querySelectorAll("[data-image]")[0].src = fixture.competition.imageUrl
  card.querySelectorAll("[data-home-team]")[0].textContent = fixture.homeTeam.name
  card.querySelectorAll("[data-away-team]")[0].textContent = fixture.awayTeam.name
  card.querySelectorAll("[data-date]")[0].textContent = formatDate(fixture.startDateTime, fixture.endDateTime)
  const footer = [fixture.competition.name, fixture.name, `${fixture.venue.name}, ${fixture.venue.city}`].filter((x) => x).join(" · ")
  card.querySelectorAll("[data-footer]")[0].textContent = footer
  // TODO: update content
  return card
}

function renderFixtures(fixtures) {
  console.log(fixtures)
  const element = document.getElementById("fixtures")
  const children = fixtures.map((fixture) => (
    createCard(fixture)
  ))
  element.replaceChildren(...children)
}

async function onLoad() {
  const fixtures = await getFixtures()
  renderFixtures(fixtures)
}

document.addEventListener('DOMContentLoaded', onLoad)