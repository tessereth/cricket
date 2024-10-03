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

function createElement(tag, content, classNames=[]) {
  const elem = document.createElement(tag)
  elem.textContent = content
  classNames.forEach((x) => elem.classList.add(x))
  return elem
}
