import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const node = process.execPath
const filhos = []
let encerrando = false

function iniciar(nome, arquivo, argumentos) {
  const filho = spawn(node, [resolve(raiz, arquivo), ...argumentos], {
    cwd: raiz,
    stdio: 'inherit',
    windowsHide: true,
  })
  filhos.push(filho)
  filho.on('error', (erro) => {
    console.error(`[${nome}] ${erro.message}`)
    encerrar(1)
  })
  filho.on('exit', (codigo, sinal) => {
    if (encerrando) return
    if (codigo !== 0 || sinal) {
      console.error(`[${nome}] encerrou (${sinal ?? codigo ?? 'sem código'})`)
      encerrar(codigo ?? 1)
    }
  })
}

function encerrar(codigo = 0) {
  if (encerrando) return
  encerrando = true
  for (const filho of filhos) {
    if (filho.exitCode === null && filho.signalCode === null) filho.kill()
  }
  process.exitCode = codigo
}

process.on('SIGINT', () => encerrar())
process.on('SIGTERM', () => encerrar())

iniciar('API local com D1 remoto', 'node_modules/wrangler/bin/wrangler.js', [
  'dev',
  '--port',
  '8787',
])
iniciar('Vite', 'node_modules/vite/bin/vite.js', [])
