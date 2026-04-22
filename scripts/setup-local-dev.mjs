/**
 * Starts local Postgres (Docker Compose) and local Supabase (Storage API + stack).
 * Requires Docker Desktop (or Docker Engine) and Node.js with npx.
 */
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function run(cmd, opts = {}) {
  execSync(cmd, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    ...opts,
  })
}

function runCapture(cmd) {
  return execSync(cmd, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
  }).trim()
}

console.log('Checking Docker…')
try {
  runCapture('docker info')
} catch {
  console.error(
    'Docker does not appear to be running. Start Docker Desktop (or the Docker daemon), then retry.',
  )
  process.exit(1)
}

console.log('\nStarting Postgres (docker compose service dashboardpostgres)…')
run('docker compose up -d')

console.log('\nStarting local Supabase (includes Storage for MMS/attachments)…')
try {
  run('npx --yes supabase@latest start')
} catch {
  console.error(
    '\nSupabase failed to start. Common fixes:\n' +
      '  • Another Supabase project is using the same ports — run: npm run dev:docker:stop\n' +
      '  • Port 54322 (Supabase DB) or 54321 (API) is in use — change [db].port / [api].port in supabase/config.toml\n',
  )
  process.exit(1)
}

console.log('\n--- Copy into server/.env for local development ---\n')
console.log(
  '# Prisma: Docker Compose Postgres (see docker-compose.yml service dashboardpostgres)',
)
console.log(
  'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mydb',
)
console.log('')

try {
  const supEnv = runCapture(
    'npx --yes supabase@latest status -o env --override-name api.url=SUPABASE_URL --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY',
  )
  console.log('# Supabase JS client (Storage). Keys from your running local stack.')
  console.log(supEnv)
  console.log('')
} catch {
  console.log(
    '# Could not read Supabase status. After containers are healthy, run: npm run dev:docker:env',
  )
  console.log('')
}

console.log('# Bucket ids (case-sensitive; created from supabase/config.toml)')
console.log('SUPABASE_STORAGE_BUCKET=messaging')
console.log('SUPABASE_STORAGE_BUCKET_APPOINTMENT=appointment')
console.log('')
console.log(
  'Supabase Studio: http://127.0.0.1:54323 (see `npx supabase status` for your ports if customized)',
)
console.log('')
