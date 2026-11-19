/**
 * Confere depois do `vite build` que o bundle que vai ao ar ainda tem o botão
 * do Google. Se algum dia o Client ID faltar no build, o minificador elimina o
 * GIS como código morto e o botão some do login sem erro nenhum em lugar
 * algum — este script transforma isso em falha de build.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const pasta = join(process.cwd(), 'dist', 'assets')
const principal = readdirSync(pasta).find((arquivo) => /^index-.*\.js$/.test(arquivo))

if (!principal) {
  console.error('checar-bundle: nenhum dist/assets/index-*.js encontrado.')
  process.exit(1)
}

const codigo = readFileSync(join(pasta, principal), 'utf8')
const marcadores = [
  ['script do GIS', 'accounts.google.com/gsi/client'],
  ['renderButton', 'renderButton'],
  ['Client ID', 'apps.googleusercontent.com'],
]

const faltando = marcadores.filter(([, trecho]) => !codigo.includes(trecho))
if (faltando.length > 0) {
  console.error(`checar-bundle: ${principal} saiu SEM o botão do Google. Falta:`)
  for (const [nome] of faltando) console.error(`  - ${nome}`)
  console.error('Confira VITE_GOOGLE_CLIENT_ID no .env e src/lib/google.ts.')
  process.exit(1)
}

console.log(`checar-bundle: ${principal} com o botão do Google (${marcadores.length} marcadores).`)
