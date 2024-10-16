import { mkdir, writeFile } from "node:fs/promises"
import { fixtureData, oversData, loadData, loadBallData } from "../replay.js"

const fixtureId = parseInt(process.argv[2])

if (fixtureId <= 0 || isNaN(fixtureId)) {
  console.error(`Invalid fixtureId: ${process.argv[2]}`)
  process.exit(1)
}

await loadData(fixtureId)
await loadBallData(fixtureId)

const dir = `${import.meta.dirname}/data/${fixtureId}`
await mkdir(dir, { recursive: true })
await writeFile(`${dir}/fixture.json`, JSON.stringify(fixtureData))
await writeFile(`${dir}/overs.json`, JSON.stringify(oversData))

console.log(`Data successfully written to ${dir}`)
