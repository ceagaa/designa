import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.UX_BASE ?? 'http://localhost:5180'
const DIR = process.env.UX_SHOTS ?? 'C:/Users/carlo/AppData/Local/Temp/opencode/ux'
mkdirSync(DIR, { recursive: true })

let ok = 0
let fal = 0
const errosConsole = []
function ck(nome, cond, extra = '') {
  if (cond) {
    ok += 1
    console.log(`OK  - ${nome}`)
  } else {
    fal += 1
    console.log(`FAL - ${nome}${extra ? ' :: ' + String(extra).slice(0, 400) : ''}`)
  }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({
  acceptDownloads: true,
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await context.newPage()
page.on('pageerror', (e) => errosConsole.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const txt = m.text()
  if (/401 \(Unauthorized\)/.test(txt)) return
  errosConsole.push('console: ' + txt.slice(0, 200))
})

async function shot(nome) {
  await page.screenshot({ path: `${DIR}/${nome}.png`, fullPage: true })
}

async function dialogoBaixarPdf(tela) {
  const baixar = page.locator('button:has-text("Baixar PDF")')
  if (!(await baixar.first().isVisible().catch(() => false))) {
    const dlg = page.locator('[role=dialog]')
    if (await dlg.isVisible().catch(() => false)) {
      const gerar = dlg.locator('button:has-text("Gerar")')
      if (await gerar.count()) await gerar.click()
      await page.waitForTimeout(800)
      if (await dlg.isVisible().catch(() => false)) {
        await dlg.locator('button[aria-label="Fechar"]').click().catch(() => page.keyboard.press('Escape'))
        await page.waitForTimeout(400)
      }
    }
  }
  await page.waitForSelector('button:has-text("Baixar PDF")', { timeout: 25000 })
  const dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
  await page.locator('button:has-text("Baixar PDF")').last().click()
  const arquivo = await dl
  ck(`pdf: download da tabela (${tela})`, Boolean(arquivo && arquivo.suggestedFilename().endsWith('.pdf')), arquivo ? arquivo.suggestedFilename() : 'sem download')
}

try {
  // ---------- 1) Marca na tela de login (apos splash) ----------
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForSelector('h1:has-text("Designa")', { timeout: 20000 })
  await page.waitForSelector('#lg-email', { state: 'visible', timeout: 20000 })
  ck('login: titulo = Designa', await page.locator('h1:has-text("Designa")').first().isVisible())
  ck(
    'login: logotipo Designa visivel',
    await page.locator('img[src="/img/LOGOTIPO.png"]').first().isVisible(),
  )
  ck('login: sem referencia a Sao Joao', !(await page.content()).includes('Paraíso'))
  await shot('01-login')

  // ---------- 2) Criar conta ----------
  await page.click('button:has-text("Criar conta")')
  await page.fill('#lg-nome', 'Teste UX')
  await page.fill('#lg-email', 'ux-teste@exemplo.com')
  await page.fill('#lg-senha', 'senha-teste-123')
  await page.fill('#lg-cong', 'Cong UX Local')
  await page.fill('#lg-num', '132599')
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Setores', { timeout: 30000 })
  await page.waitForLoadState('networkidle')
  ck('home: card Saídas de Campo', (await page.locator('button:has-text("Saídas de Campo")').count()) > 0)
  ck('home: card AVI', (await page.locator('button:has-text("Áudio, Vídeo & Indicadores")').count()) > 0)
  ck('home: card TPL', (await page.locator('button:has-text("Testemunho Público Local")').count()) > 0)
  await shot('02-home')

  // ---------- 3) Campo vazio: estado inicial de conta nova ----------
  await page.click('button:has-text("Saídas de Campo")')
  await page.waitForSelector('text=Cadastre os dias de campo', { timeout: 15000 })
  ck('campo: estado vazio explica cadastro de dias', true)
  await shot('03-campo-vazio')
  await page.click('button:has-text("Configurar dias de campo")')
  await page.waitForSelector('text=Locais e horários', { timeout: 15000 })

  // ---------- 4) Adicionar sexta-feira (hoje) em Locais ----------
  await page.click('button:has-text("Adicionar ponto de encontro")')
  await page.waitForSelector('#campo-dia', { timeout: 10000 })
  const opcoes = await page.locator('#campo-dia option').allTextContents()
  const sexta = opcoes.find((o) => /sex/i.test(o))
  ck('locais: opcao sexta-feira', Boolean(sexta), opcoes.join('|'))
  if (sexta) await page.selectOption('#campo-dia', { label: sexta })
  await page.fill('#campo-hora', '18:30')
  await page.fill('#campo-local', 'Praça UX')
  await page.click('button:has-text("Salvar dia de campo")')
  await page.waitForSelector('text=Locais e horários', { timeout: 10000 })
  ck('locais: sexta adicionada', (await page.locator('article:has-text("Praça UX")').count()) > 0)
  await shot('04-locais')

  // ---------- 5) Pessoas: criar 2 dirigentes ----------
  await page.getByRole('button', { name: 'Pessoas', exact: true }).click()
  await page.waitForSelector('text=/Quadro de pessoas|Nenhuma pessoa cadastrada/', { timeout: 15000 })
  async function novaPessoa(nome, comoAjudante) {
    const fab = page.locator('button[aria-label="Novo dirigente"]')
    if (await fab.count()) await fab.click()
    else await page.click('button:has-text("Cadastrar primeira pessoa")')
    await page.waitForSelector('#dir-nome', { timeout: 10000 })
    await page.fill('#dir-nome', nome)
    await page.selectOption('#dir-freq', 'semanal')
    await page.locator('[role=dialog] button:text-is("Sex")').first().click()
    await page.locator('[role=dialog] button:text-is("18:30")').first().click()
    if (comoAjudante) {
      await page.locator('[role=dialog] label:has-text("Marcar como ajudante")').click()
    }
    await page.click('button:has-text("Salvar dirigente")')
    await page.waitForSelector(`article:has-text("${nome}")`, { timeout: 15000 })
  }
  await novaPessoa('Carlos Teste', false)
  await novaPessoa('Marcos Teste', true)
  ck('pessoas: 2 fichas criadas', (await page.locator('article:has-text("Marcos Teste")').count()) > 0)
  ck('pessoas: rotulo Designações AVI', (await page.locator('text=Designações AVI').count()) > 0)
  ck('pessoas: sem rotulo Aptidões AVI', (await page.locator('text=Aptidões AVI').count()) === 0)
  ck('pessoas: checkbox Participa do TPL', (await page.locator('text=Participa do TPL').count()) > 0)
  await shot('05-pessoas')

  // ---------- 6) Ajustes: nova organizacao ----------
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.waitForSelector('text=Acesso à conta', { timeout: 15000 })
  ck('ajustes: kicker Setor Campo', (await page.locator('text=Setor Campo').count()) > 0)
  ck('ajustes: kicker Avisos', (await page.locator('text=Avisos').count()) > 0)
  ck(
    'ajustes: subtitulo AVI/TPL',
    (await page.locator('text=AVI e TPL são configurados dentro da tela de cada setor').count()) > 0,
  )
  ck('ajustes: secao Equipe', (await page.locator('text=Contas com acesso ao aplicativo').count()) > 0)
  ck('ajustes: botao Abrir (Configuracao de campos)', (await page.locator('button:text-is("Abrir")').count()) > 0)
  await shot('06-ajustes')

  // ---------- 7) Campo com HOJE destacado ----------
  await page.getByRole('button', { name: 'Designações', exact: true }).click()
  const cardCampo = page.locator('button:has-text("Saídas de Campo")')
  if (await cardCampo.first().isVisible().catch(() => false)) {
    await cardCampo.first().click()
  }
  await page.waitForSelector('text=Territórios', { timeout: 15000 })
  ck('campo: bloco Territórios no card grande', true)
  ck('campo: selo Em breve', (await page.locator('text=Em breve').count()) > 0)
  ck('campo: texto do mapa em breve', (await page.locator('text=O mapa do território').count()) > 0)
  await page.waitForSelector('text=Quem dirige hoje', { timeout: 15000 })
  ck('hoje: card "Quem dirige hoje"', true)
  ck('hoje: borda ao vivo no hero', (await page.locator('.escala-hoje-branco').count()) > 0)
  await shot('07-campo-hoje')

  // ---------- 8) Gerar escala do Campo ----------
  await page.click('button[aria-label="Ações da designação"]')
  await page.locator('[role=menu] button:has-text("Gerar escala")').click()
  await page.locator('[role=dialog] h2:has-text("Gerar escala de")').waitFor({ timeout: 10000 })
  await page.locator('[role=dialog] button:has-text("Gerar")').click()
  await page.waitForSelector('text=Designação pronta', { timeout: 30000 })
  ck('campo: escala pronta', true)
  await page.waitForTimeout(500)
  await shot('08-campo-gerado')

  // ---------- 9) Modal de exportacao (Ver e Baixar PDF) ----------
  await page.click('button:has-text("Ver e Baixar PDF")')
  await page.locator('[role=dialog]:has-text("Exportar escala")').waitFor({ timeout: 15000 })
  ck('export: modal Exportar escala aberto', true)
  const temPrevia = await page
    .locator('[role=dialog] img[alt="Prévia da escala pronta para exportação"]')
    .waitFor({ state: 'visible', timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  ck('export: previa da escala visivel', temPrevia)
  let dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
  await page.locator('[role=dialog] button:has-text("Baixar PDF")').click()
  let arquivo = await dl
  ck('pdf: download da tabela (Campo)', Boolean(arquivo && arquivo.suggestedFilename().endsWith('.pdf')), arquivo ? arquivo.suggestedFilename() : 'sem download')
  dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
  await page.locator('[role=dialog] button:has-text("Baixar imagem")').click()
  arquivo = await dl
  ck('png: download da imagem (Campo)', Boolean(arquivo && /\.(png|jpg|jpeg)$/i.test(arquivo.suggestedFilename())), arquivo ? arquivo.suggestedFilename() : 'sem download')
  await page.locator('[role=dialog] button[aria-label="Fechar"]').click()
  await page.waitForSelector('text=Quem dirige hoje', { timeout: 10000 })
  await shot('09-export')

  // ---------- 10) Link de compartilhamento (#/ver/) ----------
  await page.click('button:has-text("Copiar link")')
  await page.waitForTimeout(500)
  const link = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))
  ck('link: copiado contem #/ver/', link.includes('#/ver/'), link.slice(0, 120))
  if (link.includes('#/ver/')) {
    await page.goto(link, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('text=somente leitura', { timeout: 20000 })
    ck('ver: pagina somente leitura abriu', true)
    ck('ver: hero com borda ao vivo de hoje', (await page.locator('.escala-hoje-branco').count()) > 0)
    ck('ver: marcador (hoje) na tabela', (await page.locator('.escala-card:has-text("(hoje)")').count()) > 0)
    ck('ver: botao Voltar para o app', (await page.locator('button:has-text("Voltar para o app")').count()) > 0)
    dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
    await page.locator('button:has-text("Baixar PDF")').last().click()
    arquivo = await dl
    ck('ver: PDF baixavel pela visao somente leitura', Boolean(arquivo && arquivo.suggestedFilename().endsWith('.pdf')), arquivo ? arquivo.suggestedFilename() : 'sem download')
    await shot('10-somente-leitura')
    await page.click('button:has-text("Voltar para o app")')
    await page.waitForTimeout(800)
  }
  if (!(await page.locator('text=Setores').first().isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Designações', exact: true }).click()
    await page.waitForSelector('text=Setores', { timeout: 10000 })
  }

  // ---------- 11) AVI: gerar + PDF ----------
  await page.click('button:has-text("Áudio, Vídeo & Indicadores")')
  await page.waitForSelector('text=Reunião de meio de semana', { timeout: 15000 })
  ck('avi: botao Designações AVI', (await page.locator('button:has-text("Designações AVI")').count()) > 0)
  await page.locator('button:has-text("Gerar escala")').first().click()
  await dialogoBaixarPdf('AVI')
  await shot('11-avi')

  // ---------- 12) TPL: estrutura + participantes + PDF ----------
  await page.getByRole('button', { name: 'Designações', exact: true }).click()
  await page.click('button:has-text("Testemunho Público Local")')
  await page.getByRole('tab', { name: 'Estrutura', exact: true }).click()
  await page.waitForSelector('h3:has-text("Participantes")', { timeout: 15000 })
  ck('tpl: titulo Participantes', await page.locator('h3:has-text("Participantes")').isVisible())
  ck('tpl: sem rotulo "movers"', (await page.locator('text=movers').count()) === 0)

  await page.locator('section:has(h3:text-is("Pontos de apoio")) button:has-text("Novo")').click()
  await page.fill('#tpl-ponto-nome', 'Praça UX')
  await page.locator('[role=dialog] button:has-text("Salvar")').click()
  await page.waitForSelector('li:has-text("Praça UX")', { timeout: 10000 })

  await page.locator('section:has(h3:text-is("Períodos e dias")) button:has-text("Novo")').click()
  await page.waitForSelector('#tpl-periodo-inicio', { timeout: 10000 })
  await page.locator('[role=dialog] button:text-is("Sex")').click()
  await page.fill('#tpl-periodo-inicio', '09:00')
  await page.fill('#tpl-periodo-fim', '12:00')
  await page.locator('[role=dialog] button:has-text("Salvar")').click()
  await page.waitForSelector('li:has-text("Sexta-Feira")', { timeout: 10000 })

  for (const nome of ['Ana TPL', 'Beto TPL']) {
    await page.locator('section:has(h3:text-is("Participantes")) button:has-text("Novo")').click()
    await page.waitForSelector('#tpl-pessoa-nome', { timeout: 10000 })
    await page.fill('#tpl-pessoa-nome', nome)
    await page.locator('[role=dialog] button:has-text("Salvar")').click()
    await page.waitForSelector(`li:has-text("${nome}")`, { timeout: 10000 })
  }
  ck('tpl: 2 participantes cadastrados', (await page.locator('section:has(h3:text-is("Participantes")) li').count()) >= 2)
  await shot('12-tpl-estrutura')

  await page.getByRole('tab', { name: 'Escala', exact: true }).click()
  await page.locator('button:has-text("Gerar escala")').first().click()
  await dialogoBaixarPdf('TPL')
  await shot('13-tpl')

  // ---------- 13) Links publicos /escala/:slug/:setor ----------
  const info = await page
    .evaluate(() => fetch('/api/auth/eu', { credentials: 'include' }).then((r) => r.json()).catch(() => null))
  const slug =
    info && info.usuario && info.usuario.congregacao && info.usuario.congregacao.slug
  ck('auth/eu expoe slug da congregacao', Boolean(slug), JSON.stringify(info).slice(0, 200))
  if (slug) {
    await page.goto(`${BASE}/escala/${encodeURIComponent(slug)}/CAMPO`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('text=somente leitura', { timeout: 20000 })
    ck('publico CAMPO: somente leitura', true)
    ck('publico CAMPO: botao Ir para o app', (await page.locator('button:has-text("Ir para o app")').count()) > 0)
    ck('publico CAMPO: barra fixa Baixar PDF', await page.locator('button:has-text("Baixar PDF")').last().isVisible())
    ck('publico CAMPO: borda ao vivo de hoje', (await page.locator('.escala-hoje-branco').count()) > 0)
    ck('publico CAMPO: marcador (hoje) na tabela', (await page.locator('.escala-card:has-text("(hoje)")').count()) > 0)
    dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
    await page.locator('button:has-text("Baixar PDF")').last().click()
    arquivo = await dl
    ck('publico CAMPO: PDF baixavel', Boolean(arquivo && arquivo.suggestedFilename().endsWith('.pdf')), arquivo ? arquivo.suggestedFilename() : 'sem download')
    await shot('14-publico-campo')

    await page.goto(`${BASE}/escala/${encodeURIComponent(slug)}/AVI`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('button:has-text("Ir para o app")', { timeout: 20000 })
    ck('publico AVI: pagina abre', true)
    ck('publico AVI: cartao AVI', (await page.locator('text=Áudio, Vídeo e Indicadores').count()) > 0)
    await shot('15-publico-avi')

    await page.goto(`${BASE}/escala/${encodeURIComponent(slug)}/TPL`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('button:has-text("Ir para o app")', { timeout: 20000 })
    ck('publico TPL: pagina abre', true)
    await shot('16-publico-tpl')
  }

  // ---------- 14) Pessoas: secao TPL-only ----------
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Setores', { timeout: 20000 })
  await page.getByRole('button', { name: 'Pessoas', exact: true }).click()
  await page.waitForSelector('text=/Quadro de pessoas|Nenhuma pessoa cadastrada/', { timeout: 15000 })
  await page.waitForTimeout(500)
  ck('pessoas: secao TPL-only explicativa', (await page.locator('text=Somente aqui e no TPL').count()) > 0)
  await shot('17-pessoas-tpl')

  // ---------- 15) Home: status pos-geracao ----------
  await page.getByRole('button', { name: 'Designações', exact: true }).click()
  await page.waitForTimeout(700)
  ck('home: status Escala pronta apos gerar', (await page.locator('text=Escala pronta').count()) >= 1)
  await shot('18-home-final')
} catch (erro) {
  fal += 1
  console.log('FAL - excecao no roteiro :: ' + (erro && erro.message ? erro.message : erro))
  await shot('99-erro').catch(() => {})
}

ck('console sem erros JS', errosConsole.length === 0, errosConsole.slice(0, 5).join(' | '))

console.log(`=== TEST_UX ok=${ok} fal=${fal} ===`)
await browser.close()
process.exit(fal ? 1 : 0)
