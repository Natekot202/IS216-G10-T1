// Runs once before all tests: reset the database to the known seed data,
// so every test run starts from exactly the same state (repeatable tests).
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export default async function globalSetup() {
  // the server folder, next to this e2e folder
  const serverDir = fileURLToPath(new URL('../server', import.meta.url))
  execSync('pnpm seed', { cwd: serverDir, stdio: 'inherit' })
}