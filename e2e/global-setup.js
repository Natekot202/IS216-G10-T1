// Runs ONCE before all the tests: reset the database to the seed data,
// so every run starts from exactly the same state. This is what makes the tests repeatable.
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export default async function globalSetup() {
  // the server folder, next to this e2e folder (works with the spaces in your Windows path)
  const serverDir = fileURLToPath(new URL('../server', import.meta.url))
  execSync('pnpm seed:demo', { cwd: serverDir, stdio: 'inherit' })
}