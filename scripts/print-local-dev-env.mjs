/**
 * Prints env lines for server/.env when local Supabase is already running.
 */
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

console.log(
  '# Prisma (Docker Compose Postgres)\nDATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mydb\n',
)
try {
  const out = execSync(
    'npx --yes supabase@latest status -o env --override-name api.url=SUPABASE_URL --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY',
    { cwd: root, encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  console.log('# Supabase (local stack)\n' + out.trim() + '\n')
} catch {
  console.error(
    'Could not read Supabase status. Is the stack running? Try: npm run dev:docker\n',
  )
  process.exit(1)
}
console.log(
  'SUPABASE_STORAGE_BUCKET=messaging\nSUPABASE_STORAGE_BUCKET_APPOINTMENT=appointment',
)
