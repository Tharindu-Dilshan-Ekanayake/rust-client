/**
 * Copies the gameplay code shared with the server into src/shared.
 *
 * The server repo is the source of truth (it validates everything), so edit
 * rust-server/src/shared and let this run — it is wired to `predev`/`prebuild`.
 * If the server folder isn't next to this one (e.g. a client-only deploy), the
 * committed copy is used as-is.
 */
import { cpSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, '..', 'rust-server', 'src', 'shared')
const target = join(root, 'src', 'shared')

if (!existsSync(source)) {
  console.log(`[sync-shared] ${source} not found; using the committed src/shared copy.`)
  process.exit(0)
}
for (const file of readdirSync(source)) {
  if (file.endsWith('.js')) cpSync(join(source, file), join(target, file))
}
console.log(`[sync-shared] copied shared game code from ${source}`)
