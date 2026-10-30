import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.UX_BASE ?? 'http://localhost:5180'
const DIR = process.env.UX_SHOTS ?? 'C:/Users/carlo/AppData/Local/Temp/opencode/ux'
const SUFIXO = Date.now().toString(36)
const EMAIL_TESTE = `ux-${SUFIXO}@exemplo.com`
const CONG_TESTE = `Cong UX ${SUFIXO}`
// O roteiro usa o dia de hoje para o Campo, então roda em qualquer dia da semana.
const HOJE_IDX = new Date().getDay()
const DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][HOJE_IDX]
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
// O Edge headless expõe navigator.share, mas não abre a folha de compartilhamento.
// Guardamos a URL compartilhada para conferir o link sem depender do sistema.
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: async (dados) => {
      window.__shareDesigna = dados?.url ?? dados?.text ?? ''
    },
  })
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
  await page.waitForSelector('#lg-email', { state: 'visible', timeout: 20000 })
  ck('login: titulo visual e logotipo', await page.locator('h1 img[src="/img/LOGOTIPO.png"]').first().isVisible())
  ck(
    'login: logotipo Designa visivel',
    await page.locator('img[src="/img/LOGOTIPO.png"]').first().isVisible(),
  )
  ck('login: sem titulo Designa duplicado', (await page.locator('h1').first().innerText()).trim() === '')
  ck('login: sem referencia a Sao Joao', !(await page.content()).includes('Paraíso'))
  await shot('01-login')

  // ---------- 2) Criar conta ----------
  await page.click('button:has-text("Criar conta")')
  await page.fill('#lg-nome', 'Teste UX')
  await page.fill('#lg-email', EMAIL_TESTE)
  await page.fill('#lg-senha', 'senha-teste-123')
  await page.fill('#lg-cong', CONG_TESTE)
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

  // ---------- 4) Adicionar o dia de hoje em Locais ----------
  await page.click('button:has-text("Adicionar ponto de encontro")')
  await page.waitForSelector('#campo-dia', { timeout: 10000 })
  const opcoes = await page.locator('#campo-dia option').allTextContents()
  ck('locais: todos os dias disponiveis', opcoes.length === 7, opcoes.join('|'))
  await page.selectOption('#campo-dia', String(HOJE_IDX))
  await page.fill('#campo-hora', '18:30')
  await page.fill('#campo-local', 'Praça UX')
  await page.click('button:has-text("Salvar dia de campo")')
  await page.waitForSelector('text=Locais e horários', { timeout: 10000 })
  ck('locais: dia de hoje adicionado', (await page.locator('article:has-text("Praça UX")').count()) > 0)
  await shot('04-locais')

  // ---------- 5) Voluntários: criar 2 do Campo ----------
  await page.getByRole('button', { name: 'Voluntários', exact: true }).click()
  await page.waitForSelector('text=/Quadro de voluntários|Nenhum voluntário cadastrado/', { timeout: 15000 })
  async function novaPessoa(nome, comoAjudante) {
    const fab = page.locator('button[aria-label="Novo voluntário"]')
    if (await fab.count()) await fab.click()
    else await page.click('button:has-text("Cadastrar primeiro voluntário")')
    // O modal pergunta o departamento antes de mostrar a ficha.
    await page.locator('[role=dialog] button:has-text("Dirige no serviço de campo")').click()
    await page.waitForSelector('#dir-nome', { timeout: 10000 })
    await page.fill('#dir-nome', nome)
    await page.selectOption('#dir-freq', 'semanal')
    await page.selectOption('#dir-limite-mensal', '3')
    await page.locator(`[role=dialog] button:text-is("${DIA_CURTO}")`).first().click()
    await page.locator('[role=dialog] button:text-is("18:30")').first().click()
    if (comoAjudante) {
      await page.locator('[role=dialog] label:has-text("Marcar como ajudante")').click()
    }
    await page.click('button:has-text("Salvar voluntário")')
    // Modal só fecha quando a ficha persiste; o artigo pode aparecer antes.
    await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 20000 })
    await page.waitForSelector(`article:has-text("${nome}")`, { timeout: 15000 })
  }
  await novaPessoa('Carlos Teste', false)
  await novaPessoa('Marcos Teste', true)
  ck('voluntários: 2 fichas criadas', (await page.locator('article:has-text("Marcos Teste")').count()) > 0)
  ck('voluntários: quadro com 2 pessoas', (await page.locator('text=2 voluntários').count()) > 0)
  ck('voluntários: departamento Campo visível', (await page.locator('article:has-text("Carlos Teste"):has-text("Campo")').count()) > 0)
  ck('voluntários: atalho de inativo', (await page.locator('button[aria-label="Marcar Carlos Teste como inativo"]').count()) > 0)

  // O formulário muda conforme o departamento: AVI mostra reuniões e funções.
  await page.locator('button[aria-label="Novo voluntário"]').click()
  await page
    .locator('[role=dialog] button:has-text("Áudio, Vídeo & Indicadores nas reuniões")')
    .click()
  await page.waitForSelector('#dir-nome', { timeout: 10000 })
  const dlgAvi = page.locator('[role=dialog]')
  ck(
    'voluntários: campos do AVI',
    (await dlgAvi.getByText('Reuniões').count()) > 0 &&
      (await dlgAvi.getByText('Designações AVI').count()) > 0,
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await shot('05-voluntarios')

  // ---------- 6) Ajustes: nova organizacao ----------
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.waitForSelector('text=Acesso à conta', { timeout: 15000 })
  ck('ajustes: kicker Configurações gerais', (await page.locator('text=Configurações gerais').count()) > 0)
  ck('ajustes: kicker Avisos', (await page.locator('text=Avisos').count()) > 0)
  ck(
    'ajustes: subtitulo de configuracoes por setor',
    (await page.locator('text=/configurações por setor/i').count()) > 0,
  )
  ck('ajustes: secao Equipe', (await page.locator('text=Contas com acesso ao aplicativo').count()) > 0)
  ck('ajustes: cards de configuracao dos setores', (await page.locator('button:has-text("Saídas de Campo"), button:has-text("Áudio, Vídeo & Indicadores"), button:has-text("Testemunho Público Local")').count()) === 3)
  await shot('06-ajustes')
  await page.getByRole('button', { name: /Saídas de Campo/ }).click()
  await page.waitForSelector('text=Configurações do setor Campo', { timeout: 10000 })
  ck('ajustes: card Campo abre configuracao do setor', true)

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
  await page.waitForSelector('text=/Quem dirige hoje|Próxima saída|Primeira saída/', { timeout: 15000 })
  const temDestaqueHoje = (await page.locator('text=Quem dirige hoje').count()) > 0
  ck('campo: card de destaque (hoje ou próxima saída)', true)
  if (temDestaqueHoje) {
    ck('hoje: borda ao vivo no hero', (await page.locator('.escala-hoje-branco').count()) > 0)
  }
  await shot('07-campo-hoje')

  // ---------- 8) Gerar escala do Campo ----------
  await page.click('button[aria-label="Ações da designação"]')
  await page.locator('[role=menu] button:has-text("Gerar escala")').click()
  await page.locator('[role=dialog] h2:has-text("Gerar escala de")').waitFor({ timeout: 10000 })
  await page.locator('[role=dialog] button:has-text("Gerar")').click()
  await page.waitForFunction(() => {
    const texto = document.body.innerText
    return texto.includes('Designação pronta') || /Gerada · \d+ sem designação/.test(texto)
  }, undefined, { timeout: 30000 })
  ck('campo: geração finalizada', !(await page.locator('text=Pendente de montar').count()))
  await page.waitForTimeout(500)
  await shot('08-campo-gerado')

  // ---------- 9) PDF pronto (rodapé fixo: Gerar / PDF / Link) ----------
  ck('campo: rodapé fixo tem os 3 botões', (await page.locator('button:has-text("Gerar")').count()) > 0 && (await page.locator('button:has-text("PDF")').count()) > 0 && (await page.locator('button:has-text("Link")').count()) > 0)
  let dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
  await page.locator('button:has-text("PDF")').click()
  let arquivo = await dl
  ck('pdf: download direto da escala (Campo)', Boolean(arquivo && arquivo.suggestedFilename().endsWith('.pdf')), arquivo ? arquivo.suggestedFilename() : 'sem download')
  await shot('09-export')

  // ---------- 10) Link de compartilhamento (#/ver/) ----------
  await page.click('button:has-text("Link")')
  await page.waitForFunction(() => Boolean(window.__shareDesigna), undefined, { timeout: 10000 })
  const link = await page.evaluate(() => window.__shareDesigna ?? '')
  ck('link: copiado contem #/ver/', link.includes('#/ver/'), link.slice(0, 120))
  if (link.includes('#/ver/')) {
    await page.goto(link, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('h1:has-text("Programação para serviço de campo")', { timeout: 20000 })
    ck('ver: programação compartilhada abriu', true)
    ck('ver: card de destaque presente', (await page.locator('text=/Quem dirige hoje|Próxima saída|Última saída/').count()) > 0)
    if ((await page.locator('text=Quem dirige hoje').count()) > 0) {
      ck('ver: hero com borda ao vivo de hoje', (await page.locator('.escala-hoje-branco').count()) > 0)
    }
    ck('ver: lista única de próximos dias', (await page.locator('h2:has-text("Próximos dias")').count()) > 0)
    ck('ver: sem botões de grupo de dias', (await page.locator('[aria-label="Grupos de dias"]').count()) === 0)
    ck('ver: sem botão voltar para o app', (await page.locator('button:has-text("Voltar para o app")').count()) === 0)
    ck('ver: sem botão ir para o app', (await page.locator('button:has-text("Ir para o app")').count()) === 0)
    ck('ver: sem texto somente leitura', !(await page.locator('text=/somente leitura/i').count()))
    ck('ver: sem botao de exportacao', !(await page.locator('button:has-text("Baixar PDF"), button:has-text("Baixar imagem")').count()))
    await shot('10-somente-leitura')
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(800)
  }
  if (!(await page.locator('text=Setores').first().isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Designações', exact: true }).click()
    await page.waitForSelector('text=Setores', { timeout: 10000 })
  }

  // ---------- 10b) Campo: restaurar dia volta designado + ajudante nas listas ----------
  await page.locator('button:has-text("Saídas de Campo")').first().click()
  await page.waitForSelector('text=Territórios', { timeout: 15000 })
  await page.locator('button:has-text("Ajustar escala")').click()
  await page.waitForSelector('h1:has-text("Tabela completa")', { timeout: 15000 })
  await shot('10b-tabela')

  // (a) Remover o único dia: vira "removido" e não conta como pendência.
  await page.locator('button[aria-label^="Remover"]').first().click()
  await page.waitForTimeout(300)
  let stats = (await page.locator('p[aria-live="polite"]').innerText()).replace(/\s+/g, ' ')
  ck('tabela: dia removido conta como removido', /1 removidos?/.test(stats), stats)
  ck('tabela: dia removido não vira pendência', /0 sem designação/.test(stats), stats)

  // (b) Restaurar: o dia volta designado (não zerado/pendência).
  await page.locator('button[aria-label^="Restaurar"]').first().click()
  await page.waitForTimeout(400)
  stats = (await page.locator('p[aria-live="polite"]').innerText()).replace(/\s+/g, ' ')
  ck('tabela: restaurado volta designado (0 pendências)', /0 sem designação/.test(stats), stats)
  const mDias = stats.match(/(\d+) dias? de campo\s+(\d+) designados?/)
  ck(
    'tabela: restaurado volta como designado (sem dia zerado)',
    Boolean(mDias) && mDias[1] === mDias[2],
    stats,
  )
  await shot('10c-tabela-restaurado')

  // (c) Ajudante manual (Marcos Teste) no dia de HOJE (o card de destaque).
  // A tabela vem ordenada por data: o último select é o dia mais futuro do mês.
  const selAjudante = page.locator('select[aria-label^="Ajudante de"]').last()
  ck('tabela: select de ajudante visível', await selAjudante.isVisible().catch(() => false))
  const textoAjudante = (
    await selAjudante
      .locator('option', { hasText: 'Marcos Teste' })
      .first()
      .innerText()
      .catch(() => '')
  ).trim()
  ck('tabela: Marcos Teste disponível como ajudante', Boolean(textoAjudante), textoAjudante)
  if (textoAjudante) await selAjudante.selectOption({ label: textoAjudante })
  await page.waitForTimeout(300)
  await page.locator('button[aria-label="Voltar"]').click()
  // O card de destaque sempre existe; a lista "Próximos dias" só com mais dias.
  await page.waitForSelector('text=/Quem dirige hoje|Próxima saída|Primeira saída/', { timeout: 15000 })
  ck('campo: destaque interno mostra ajudante discreto', (await page.locator('section p:has-text("Ajudante:")').count()) > 0)
  await shot('10d-campo-ajudante')

  // (d) Ajudante também na página pública do link.
  await page.evaluate(() => {
    window.__shareDesigna = ''
  })
  await page.click('button:has-text("Link")')
  await page.waitForFunction(() => Boolean(window.__shareDesigna), undefined, { timeout: 10000 })
  const linkAj = await page.evaluate(() => window.__shareDesigna ?? '')
  if (linkAj.includes('#/ver/')) {
    await page.goto(linkAj, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('h1:has-text("Programação para serviço de campo")', { timeout: 20000 })
    ck('ver: destaque público mostra ajudante discreto', (await page.locator('section p:has-text("Ajudante:")').count()) > 0)
    if (await page.locator('article').count()) {
      ck('ver: lista pública mostra ajudante discreto', (await page.locator('article p:has-text("Marcos Teste")').count()) > 0)
    }
    await shot('10e-ver-ajudante')
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(800)
  }
  if (!(await page.locator('text=Setores').first().isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Designações', exact: true }).click()
    await page.waitForSelector('text=Setores', { timeout: 10000 })
  }

  // ---------- 11) AVI: resumo + ajustar + gerar + PDF ----------
  await page.click('button:has-text("Áudio, Vídeo & Indicadores")')
  await page.waitForSelector('button:has-text("Ajustar escala")', { timeout: 15000 })
  // A tela abre na hora; espere o setor terminar de carregar (skeleton sumir) antes
  // de decidir trocar de mês — senão a ação é ignorada em silêncio.
  await page.waitForSelector('section.h-\\[15rem\\]', { state: 'hidden', timeout: 20000 })
  let temHeroAvi =
    (await page.locator('text=/Quem serve hoje|Próxima reunião|Primeira reunião/').count()) > 0
  if (!temHeroAvi) {
    // Sem reuniões restantes no mês corrente: o mês seguinte sempre tem destaque.
    await page.click('button[aria-label="Próximo mês"]')
    await page.waitForSelector('section.h-\\[15rem\\]', { state: 'hidden', timeout: 20000 })
    temHeroAvi =
      (await page.locator('text=/Quem serve hoje|Próxima reunião|Primeira reunião/').count()) > 0
  }
  ck('avi: resumo com hero de reunião', temHeroAvi)
  ck('avi: sem faixas FDS/meio de semana no resumo', (await page.locator('text=Meio de semana').count()) === 0)
  ck(
    'avi: rodapé fixo Gerar/PDF/Link',
    (await page.locator('button:has-text("Gerar")').count()) > 0 &&
      (await page.locator('button:has-text("PDF")').count()) > 0 &&
      (await page.locator('button:has-text("Link")').count()) > 0,
  )
  await page.locator('button:has-text("Ajustar escala")').first().click()
  await page.waitForSelector('select[id^="avi-"]', { timeout: 15000 })
  ck('avi: botao Designações AVI', (await page.locator('button:has-text("Designações AVI")').count()) > 0)
  await page.locator('button:has-text("Gerar escala")').first().click()
  await dialogoBaixarPdf('AVI')
  await shot('11-avi')

  // ---------- 12) TPL: voluntários + estrutura + escala manual + PDF ----------
  await page.getByRole('button', { name: 'Voluntários', exact: true }).click()
  await page.waitForSelector('text=Quadro de voluntários', { timeout: 15000 })
  async function novoVoluntarioTpl(nome) {
    await page.locator('button[aria-label="Novo voluntário"]').click()
    // Departamento primeiro; a ficha do TPL abre em seguida.
    await page.locator('[role=dialog] button:has-text("Testemunho Público Local com o carrinho")').click()
    await page.waitForSelector('#dir-nome', { timeout: 10000 })
    await page.fill('#dir-nome', nome)
    await page.click('button:has-text("Salvar voluntário")')
    // O modal só fecha quando a ficha persiste — o artigo pode aparecer antes disso.
    await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 20000 })
    await page.waitForSelector(`article:has-text("${nome}")`, { timeout: 15000 })
  }
  await novoVoluntarioTpl('Ana TPL')
  await novoVoluntarioTpl('Beto TPL')
  ck('voluntários: TPL no quadro', (await page.locator('article:has-text("Ana TPL"):has-text("TPL")').count()) > 0)
  await shot('12-voluntarios-tpl')

  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.waitForSelector('text=Configurações gerais', { timeout: 15000 })
  await page.getByRole('button', { name: /Testemunho Público Local/ }).click()
  await page.waitForSelector('h3:has-text("Pontos de apoio")', { timeout: 15000 })
  ck('ajustes TPL: sem abas Escala/Estrutura', (await page.getByRole('tab').count()) === 0)
  ck('tpl: sem seção Participantes', (await page.locator('h3:has-text("Participantes")').count()) === 0)
  ck('tpl: sem rótulo "movers"', (await page.locator('text=movers').count()) === 0)

  await page.locator('section:has(h3:text-is("Pontos de apoio")) button:has-text("Adicionar ponto de apoio")').click()
  await page.fill('#tpl-ponto-nome', 'Praça UX')
  await page.locator('[role=dialog] button:has-text("Salvar")').click()
  // O modal só fecha após a persistência; o item e o botão de período dependem
  // do ponto já salvo — aguarde o estado real, não o texto do placeholder.
  await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 20000 })
  await page.waitForSelector('section:has(h3:text-is("Pontos de apoio")) li:has-text("Praça UX")', {
    timeout: 15000,
  })
  await page.waitForSelector(
    'section:has(h3:text-is("Períodos e dias")) button:has-text("Adicionar período"):not([disabled])',
    { timeout: 15000 },
  )

  await page.locator('section:has(h3:text-is("Períodos e dias")) button:has-text("Adicionar período")').click()
  await page.waitForSelector('#tpl-periodo-inicio', { timeout: 10000 })
  await page.locator('[role=dialog] button:text-is("Sex")').click()
  await page.fill('#tpl-periodo-inicio', '09:00')
  await page.fill('#tpl-periodo-fim', '12:00')
  await page.locator('[role=dialog] button:has-text("Salvar")').click()
  // Assim como no ponto: o modal só some quando o período persiste.
  await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 20000 })
  await page.waitForSelector(
    'section:has(h3:text-is("Períodos e dias")) li:has-text("Sexta-Feira")',
    { timeout: 15000 },
  )
  await shot('13-tpl-estrutura')

  await page.getByRole('button', { name: 'Designações', exact: true }).click()
  await page.click('button:has-text("Testemunho Público Local")')
  await page.waitForSelector('button:has-text("Ajustar escala")', { timeout: 15000 })
  // Mesma espera ativa do AVI: não troque de mês com o setor ainda carregando.
  await page.waitForSelector('section.h-\\[15rem\\]', { state: 'hidden', timeout: 20000 })
  let temHeroTpl =
    (await page.locator('text=/Quem trabalha hoje|Próxima saída|Primeira saída/').count()) > 0
  if (!temHeroTpl) {
    // Sem saídas restantes no mês corrente: o mês seguinte sempre tem destaque.
    await page.click('button[aria-label="Próximo mês"]')
    await page.waitForSelector('section.h-\\[15rem\\]', { state: 'hidden', timeout: 20000 })
    temHeroTpl =
      (await page.locator('text=/Quem trabalha hoje|Próxima saída|Primeira saída/').count()) > 0
  }
  ck('tpl: resumo com hero de saída', temHeroTpl)
  ck('tpl: sem link público na tela', (await page.locator('text=/Link público/').count()) === 0)
  ck(
    'tpl: rodapé fixo Ajustar/PDF/Link',
    (await page.locator('button:has-text("Ajustar")').count()) > 0 &&
      (await page.locator('button:has-text("PDF")').count()) > 0 &&
      (await page.locator('button:has-text("Link")').count()) > 0,
  )
  await page.locator('button:has-text("Ajustar escala")').first().click()
  const selectsTpl = page.locator('select[id^="tpl-"]')
  await selectsTpl.first().waitFor({ timeout: 15000 })
  ck('tpl: sem abas Escala/Estrutura', (await page.getByRole('tab').count()) === 0)
  await selectsTpl.first().selectOption({ label: 'Ana TPL' })
  await selectsTpl.nth(1).selectOption({ label: 'Beto TPL' })
  ck('tpl: dupla manual atribuída', (await page.locator('text=manual').count()) > 0)
  await dialogoBaixarPdf('TPL')
  await shot('14-tpl')

  // ---------- 13) Links publicos /escala/:slug/:setor ----------
  const info = await page
    .evaluate(() => fetch('/api/auth/eu', { credentials: 'include' }).then((r) => r.json()).catch(() => null))
  const slug =
    info && info.usuario && info.usuario.congregacao && info.usuario.congregacao.slug
  ck('auth/eu expoe slug da congregacao', Boolean(slug), JSON.stringify(info).slice(0, 200))
  if (slug) {
    await page.goto(`${BASE}/escala/${encodeURIComponent(slug)}/CAMPO`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('h1:has-text("Programação para serviço de campo")', { timeout: 20000 })
    ck('publico CAMPO: programação abre', true)
    ck('publico CAMPO: sem chamadas de somente leitura', !(await page.locator('text=/somente leitura/i').count()))
    ck('publico CAMPO: sem botões de download', !(await page.locator('button:has-text("Baixar PDF"), button:has-text("Baixar imagem")').count()))
    if ((await page.locator('text=Quem dirige hoje').count()) > 0) {
      ck('publico CAMPO: borda ao vivo de hoje', (await page.locator('.escala-hoje-branco').count()) > 0)
    }
    ck('publico CAMPO: lista única de próximos dias', (await page.locator('h2:has-text("Próximos dias")').count()) > 0)
    ck('publico CAMPO: sem botões de grupo de dias', (await page.locator('[aria-label="Grupos de dias"]').count()) === 0)
    ck('publico CAMPO: sem botão Ir para o app', (await page.locator('button:has-text("Ir para o app")').count()) === 0)
    await shot('15-publico-campo')

    await page.goto(`${BASE}/escala/${encodeURIComponent(slug)}/AVI`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('button:has-text("Baixar PDF")', { timeout: 20000 })
    ck('publico AVI: pagina abre', true)
    ck('publico AVI: cartao AVI', (await page.locator('text=Áudio, Vídeo e Indicadores').count()) > 0)
    ck('publico AVI: sem botao Ir para o app', (await page.locator('button:has-text("Ir para o app")').count()) === 0)
    await shot('16-publico-avi')

    await page.goto(`${BASE}/escala/${encodeURIComponent(slug)}/TPL`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('button:has-text("Baixar PDF")', { timeout: 20000 })
    ck('publico TPL: pagina abre', true)
    ck('publico TPL: sem botao Ir para o app', (await page.locator('button:has-text("Ir para o app")').count()) === 0)
    await shot('17-publico-tpl')
  }

  // ---------- 14) Voluntários: TPL no quadro ----------
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Setores', { timeout: 20000 })
  await page.getByRole('button', { name: 'Voluntários', exact: true }).click()
  await page.waitForSelector('text=Quadro de voluntários', { timeout: 15000 })
  await page.waitForTimeout(500)
  ck('voluntários: TPL no quadro', (await page.locator('article:has-text("Ana TPL"):has-text("TPL")').count()) > 0)
  await shot('18-voluntarios-final')

  // ---------- 15) Home: status pos-geracao ----------
  await page.getByRole('button', { name: 'Designações', exact: true }).click()
  await page.waitForTimeout(700)
  ck('home: status Escala pronta apos gerar', (await page.locator('text=Escala pronta').count()) >= 1)
  await shot('19-home-final')
} catch (erro) {
  fal += 1
  console.log('FAL - excecao no roteiro :: ' + (erro && erro.message ? erro.message : erro))
  await shot('99-erro').catch(() => {})
}

ck('console sem erros JS', errosConsole.length === 0, errosConsole.slice(0, 5).join(' | '))

console.log(`=== TEST_UX ok=${ok} fal=${fal} ===`)
await browser.close()
process.exit(fal ? 1 : 0)
