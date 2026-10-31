import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.UX_BASE ?? 'http://localhost:5180'
const BASE_API = process.env.UX_API ?? 'http://127.0.0.1:8787'
const DIR = process.env.UX_SHOTS ?? join(tmpdir(), 'opencode', 'ux')
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
  // O /api/auth/eu responde 401 nas páginas públicas (sem sessão); é esperado.
  if (/401/.test(txt)) return
  errosConsole.push('console: ' + txt.slice(0, 200))
})

async function shot(nome) {
  await page.screenshot({ path: `${DIR}/${nome}.png`, fullPage: true })
}

/**
 * Foto do cartão de exportação (mesmo DOM que vira PDF). Ele fica fora da tela
 * em left:-10000px; trazemos para a área visível, fotografamos e restauramos.
 */
async function shotCard(nome) {
  const achou = await page.evaluate(() => {
    for (const card of document.querySelectorAll('.escala-card')) {
      const caixa = card.closest('[class*="-10000px"]')
      if (!caixa) continue
      caixa.setAttribute('data-shot', '1')
      caixa.style.left = '0px'
      caixa.style.zIndex = '60'
      return true
    }
    return false
  })
  ck(`cartao de PDF fotografado (${nome})`, achou)
  if (!achou) return
  await page.waitForTimeout(150)
  await page
    .locator('[class*="-10000px"] .escala-card')
    .first()
    .screenshot({ path: `${DIR}/card-${nome}.png` })
  await page.evaluate(() => {
    const caixa = document.querySelector('[data-shot="1"]')
    if (caixa) {
      caixa.style.left = ''
      caixa.style.zIndex = ''
      caixa.removeAttribute('data-shot')
    }
  })
}

/**
 * Salva a ficha e aguarda o PUT de estado. Quando o voluntário tem AVI, também
 * espera o PUT do setor (aptidões) para não navegar antes da persistência.
 */
async function salvarComEspera({ setor = false } = {}) {
  const esperas = [
    page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes('/api/estado'),
      { timeout: 20000 },
    ),
  ]
  if (setor) {
    esperas.push(
      page.waitForResponse(
        (r) => r.request().method() === 'PUT' && r.url().includes('/api/setor/'),
        { timeout: 20000 },
      ),
    )
  }
  const puts = Promise.all(esperas)
  await page.click('button:has-text("Salvar voluntário")')
  await puts
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
  /** Chip (button aria-pressed) dentro da página de edição do voluntário. */
  const chip = (texto) => page.locator(`button[aria-pressed]:text-is("${texto}")`).first()
  async function novaPessoa(nome, comoAjudante) {
    const fab = page.locator('button[aria-label="Novo voluntário"]')
    if (await fab.count()) await fab.click()
    else await page.click('button:has-text("Cadastrar primeiro voluntário")')
    // A página de edição pergunta os departamentos antes de mostrar a ficha.
    await page.locator('button:has-text("Dirige no serviço de campo")').click()
    await page.locator('button:has-text("Continuar")').click()
    await page.waitForSelector('#dir-nome', { timeout: 10000 })
    await page.fill('#dir-nome', nome)
    await chip('Semanal').click()
    await chip('Até 3x').click()
    await chip(DIA_CURTO).click()
    await chip('18:30').click()
    if (comoAjudante) await chip('Marcar como ajudante').click()
    await salvarComEspera()
    // A página só volta para a lista quando a ficha persiste.
    await page.waitForSelector('h2:has-text("Quadro de voluntários")', { timeout: 20000 })
    await page.waitForSelector(`article:has-text("${nome}")`, { timeout: 15000 })
  }
  await novaPessoa('Carlos Teste', false)
  await novaPessoa('Marcos Teste', true)
  ck('voluntários: 2 fichas criadas', (await page.locator('article:has-text("Marcos Teste")').count()) > 0)
  ck('voluntários: quadro com 2 pessoas', (await page.locator('text=2 voluntários').count()) > 0)
  ck('voluntários: departamento Campo visível', (await page.locator('article:has-text("Carlos Teste"):has-text("Campo")').count()) > 0)
  ck('voluntários: lista com selo Disponível', (await page.locator('article:has-text("Carlos Teste"):has-text("Disponível")').count()) > 0)
  ck('voluntários: lista sem campos extras', (await page.locator('article:has-text("Carlos Teste") select, article:has-text("Carlos Teste") button[aria-pressed]').count()) === 0)
  ck('voluntários: ajudante fora da lista', (await page.locator('article:has-text("Marcos Teste"):has-text("Ajudante")').count()) === 0)

  // Um voluntário pode servir em mais de um departamento; o quadro mostra todos.
  await page.locator('button[aria-label="Novo voluntário"]').click()
  await page.locator('button:has-text("Dirige no serviço de campo")').click()
  await page
    .locator('button:has-text("Áudio, Vídeo & Indicadores nas reuniões")')
    .click()
  await page.locator('button:has-text("Continuar")').click()
  await page.waitForSelector('#dir-nome', { timeout: 10000 })
  await page.fill('#dir-nome', 'Paula Multi')
  await chip('Semanal').click()
  await chip(DIA_CURTO).click()
  await chip('18:30').click()
  await salvarComEspera()
  const regrasPersistidas = await page.evaluate(async () => {
    const resposta = await fetch('/api/estado', { cache: 'no-store' })
    const corpo = await resposta.json()
    const pessoa = (corpo.estado?.dirigentes ?? []).find(
      (d) => d.nome === 'Paula Multi',
    )
    return pessoa?.regrasDepartamento ?? null
  })
  ck(
    'voluntários: frequências persistidas por departamento',
    regrasPersistidas?.CAMPO?.frequencia === 'semanal' &&
      regrasPersistidas?.CAMPO?.limiteMensal === 1 &&
      regrasPersistidas?.AUDIO_VIDEO?.frequencia === 'mensal' &&
      regrasPersistidas?.AUDIO_VIDEO?.limiteMensal === 3,
    JSON.stringify(regrasPersistidas),
  )
  await page.waitForSelector('h2:has-text("Quadro de voluntários")', { timeout: 20000 })
  ck(
    'voluntários: multi-departamento no quadro',
    (await page.locator('article:has-text("Paula Multi"):has-text("Campo · AVI")').count()) > 0,
  )
  await page.locator('article:has-text("Paula Multi")').click()
  await page.waitForSelector('#dir-nome', { timeout: 10000 })
  ck(
    'voluntários: ficha multi mostra os dois departamentos',
    (await page.getByText('Campo · AVI').count()) > 0,
  )
  ck(
    'voluntários: cards separados por departamento',
    (await page.locator('[data-departamento="CAMPO"]').count()) === 1 &&
      (await page.locator('[data-departamento="AUDIO_VIDEO"]').count()) === 1,
  )
  const cardCampoMulti = page.locator('[data-departamento="CAMPO"]')
  const cardAviMulti = page.locator('[data-departamento="AUDIO_VIDEO"]')
  ck(
    'voluntários: Ajudante apenas no card Campo',
    (await cardCampoMulti.getByText('Ajudante', { exact: true }).count()) === 1 &&
      (await cardAviMulti.getByText('Ajudante', { exact: true }).count()) === 0,
  )
  ck(
    'voluntários: frequência própria de cada departamento',
    (await cardCampoMulti
      .locator('button[aria-pressed]:text-is("Semanal")')
      .getAttribute('aria-pressed')) === 'true' &&
      (await cardCampoMulti
        .locator('button[aria-pressed]:text-is("1x no mês")')
        .getAttribute('aria-pressed')) === 'true' &&
      (await cardAviMulti
        .locator('button[aria-pressed]:text-is("Mensal")')
        .getAttribute('aria-pressed')) === 'true' &&
      (await cardAviMulti
        .locator('button[aria-pressed]:text-is("Até 3x")')
        .getAttribute('aria-pressed')) === 'true',
  )
  await page.locator('button[aria-label="Voltar para voluntários"]').click()
  await page.waitForSelector('h2:has-text("Quadro de voluntários")', { timeout: 10000 })

  // Tocar num nome abre OUTRA PÁGINA (não modal) com a ficha completa em chips.
  await page.locator('article:has-text("Carlos Teste")').click()
  await page.waitForSelector('#dir-nome', { timeout: 10000 })
  ck('voluntários: edição abre como página', (await page.locator('[role=dialog]').count()) === 0)
  ck('voluntários: sem telefone na ficha', (await page.locator('#dir-telefone').count()) === 0)
  const fichaCampo = page.getByTestId('ficha-voluntario')
  ck(
    'voluntários: ficha Campo sem seções AVI',
    (await fichaCampo.getByText('Reuniões').count()) === 0 &&
      (await fichaCampo.getByText('Designações AVI').count()) === 0,
  )
  ck('voluntários: chip de frequência', (await chip('Semanal').count()) > 0)
  ck('voluntários: chips de frequência mensal', (await chip('Até 3x').count()) > 0)
  ck('voluntários: chips de disponibilidade', (await chip('Inativo').count()) > 0)
  ck('voluntários: salvar em largura total', await page.locator('button:has-text("Salvar voluntário")').evaluate((el) => el.getBoundingClientRect().width > el.parentElement.getBoundingClientRect().width - 4).catch(() => false))
  ck('voluntários: excluir no fim da ficha', await page.locator('button:has-text("Excluir voluntário")').isVisible().catch(() => false))
  await shot('05a-voluntario-edicao')
  await page.locator('button[aria-label="Voltar para voluntários"]').click()
  await page.waitForSelector('h2:has-text("Quadro de voluntários")', { timeout: 10000 })

  // O formulário muda conforme os departamentos: AVI mostra reuniões e funções.
  await page.locator('button[aria-label="Novo voluntário"]').click()
  await page
    .locator('button:has-text("Áudio, Vídeo & Indicadores nas reuniões")')
    .click()
  await page.locator('button:has-text("Continuar")').click()
  await page.waitForSelector('#dir-nome', { timeout: 10000 })
  const fichaAvi = page.getByTestId('ficha-voluntario')
  ck(
    'voluntários: campos do AVI',
    (await fichaAvi.getByText('Reuniões').count()) > 0 &&
      (await fichaAvi.getByText('Designações AVI').count()) > 0 &&
      (await fichaAvi.getByText('Frequência de designação').count()) > 0 &&
      (await fichaAvi.getByText('Disponibilidade').count()) > 0,
  )
  ck(
    'voluntários: ficha AVI sem seções do Campo',
    (await fichaAvi.getByText('Dias disponíveis').count()) === 0 &&
      (await fichaAvi.getByText('Ajudante', { exact: true }).count()) === 0,
  )
  await page.locator('button[aria-label="Voltar para a lista"]').click()
  await page.waitForSelector('h2:has-text("Quadro de voluntários")', { timeout: 10000 })
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
  ck(
    'ajustes: campo sem compartilhamento',
    (await page.getByText('Compartilhamento', { exact: true }).count()) === 0 &&
      (await page.getByText('Aviso por WhatsApp', { exact: true }).count()) === 0 &&
      (await page.getByText('Gerar PDF da Escala Mensal', { exact: true }).count()) === 0,
  )

  // ---------- 7) Campo com HOJE destacado ----------
  await page.getByRole('button', { name: 'Designações', exact: true }).click()
  const cardCampo = page.locator('button:has-text("Saídas de Campo")')
  if (await cardCampo.first().isVisible().catch(() => false)) {
    await cardCampo.first().click()
  }
  await page.waitForSelector('text=Territórios', { timeout: 15000 })
  ck('campo: bloco Territórios no card grande', true)
  ck('campo: selo Em breve', (await page.locator('text=Em breve').count()) > 0)
  await page.waitForSelector('text=/Próxima designação|Primeira saída/', { timeout: 15000 })
  ck('campo: card de destaque (próxima designação ou primeira saída)', true)
  if ((await page.locator('.escala-hoje-branco').count()) > 0) {
    ck('hoje: borda ao vivo no hero', true)
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
  await shotCard('campo')

  // ---------- 9) PDF pronto (rodapé fixo: Gerar / PDF / Link) ----------
  ck('campo: rodapé fixo tem os 3 botões', (await page.locator('button:has-text("Gerar")').count()) > 0 && (await page.locator('button:has-text("PDF")').count()) > 0 && (await page.locator('button:has-text("Link")').count()) > 0)
  let dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
  await page.locator('button:has-text("PDF")').click()
  let arquivo = await dl
  ck('pdf: download direto da escala (Campo)', Boolean(arquivo && arquivo.suggestedFilename().endsWith('.pdf')), arquivo ? arquivo.suggestedFilename() : 'sem download')
  await shot('09-export')

  // ---------- 10) Link público curto (/escala/:slug/CAMPO) ----------
  await page.click('button:has-text("Link")')
  await page.waitForFunction(() => Boolean(window.__shareDesigna), undefined, { timeout: 10000 })
  const link = await page.evaluate(() => window.__shareDesigna ?? '')
  ck(
    'link: curto em /escala/:slug/CAMPO com o mês (sem #)',
    link.includes('/escala/') &&
      link.includes('/CAMPO') &&
      /[?&]mes=\d{4}-\d{1,2}/.test(link) &&
      !link.includes('#'),
    link.slice(0, 160),
  )
  if (link.includes('/escala/')) {
    await page.goto(link, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('h1:has-text("Programação para serviço de campo")', { timeout: 20000 })
    ck('ver: programação compartilhada abriu', true)
    ck('ver: card de destaque presente', (await page.locator('text=/Próxima designação|Última saída/').count()) > 0)
    if ((await page.locator('.escala-hoje-branco').count()) > 0) {
      ck('ver: hero com borda ao vivo de hoje', true)
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
  await page.waitForSelector('text=/Próxima designação|Primeira saída/', { timeout: 15000 })
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
    (await page.locator('text=/Próxima reunião|Primeira reunião/').count()) > 0
  if (!temHeroAvi) {
    // Sem reuniões restantes no mês corrente: o mês seguinte sempre tem destaque.
    await page.click('button[aria-label="Próximo mês"]')
    await page.waitForSelector('section.h-\\[15rem\\]', { state: 'hidden', timeout: 20000 })
    temHeroAvi =
      (await page.locator('text=/Próxima reunião|Primeira reunião/').count()) > 0
  }
  ck('avi: resumo com hero de reunião', temHeroAvi)
  if ((await page.locator('h2:has-text("Designações futuras")').count()) === 0) {
    await page.click('button[aria-label="Próximo mês"]')
    await page.waitForSelector('section.h-\\[15rem\\]', { state: 'hidden', timeout: 20000 })
  }
  const heroAvi = page
    .locator('section')
    .filter({ hasText: /Próxima reunião|Primeira reunião/ })
    .first()
  ck(
    'avi: hero sem rótulos Designação/Voluntários',
    (await heroAvi.getByText('Designação', { exact: true }).count()) === 0 &&
      (await heroAvi.getByText('Voluntários', { exact: true }).count()) === 0,
  )
  ck(
    'avi: seção Designações futuras',
    (await page.locator('h2:has-text("Designações futuras")').count()) > 0,
  )
  ck('avi: sem faixas FDS/meio de semana no resumo', (await page.locator('text=Meio de semana').count()) === 0)
  ck(
    'avi: rodapé fixo Gerar/PDF/Link',
    (await page.locator('button:has-text("Gerar")').count()) > 0 &&
      (await page.locator('button:has-text("PDF")').count()) > 0 &&
      (await page.locator('button:has-text("Link")').count()) > 0,
  )
  // Voluntário AVI com aptidões: o cartão do PDF precisa mostrar os nomes.
  await page.getByRole('button', { name: 'Voluntários', exact: true }).click()
  await page.waitForSelector('h2:has-text("Quadro de voluntários")', { timeout: 15000 })
  // Sem os dados do AVI carregados, as aptidões escolhidas seriam descartadas.
  await page.waitForSelector('text=Carregando as designações do AVI…', {
    state: 'hidden',
    timeout: 15000,
  })
  await page.locator('button[aria-label="Novo voluntário"]').click()
  await page
    .locator('button:has-text("Áudio, Vídeo & Indicadores nas reuniões")')
    .click()
  await page.locator('button:has-text("Continuar")').click()
  await page.waitForSelector('#dir-nome', { timeout: 10000 })
  await page.fill('#dir-nome', 'Vitor AVI')
  for (const apto of [
    'Operador de Áudio',
    'Operador de Vídeo',
    'Palco',
    'Microfone Volante',
    'Indicador interno',
    'Indicador externo',
  ]) {
    await chip(apto).click()
  }
  await salvarComEspera({ setor: true })
  await page.waitForSelector('h2:has-text("Quadro de voluntários")', { timeout: 20000 })
  await page.getByRole('button', { name: 'Designações', exact: true }).click()
  await page.waitForSelector('text=Setores', { timeout: 10000 })
  await page.click('button:has-text("Áudio, Vídeo & Indicadores")')
  await page.waitForSelector('button:has-text("Ajustar escala")', { timeout: 15000 })
  await page.waitForSelector('section.h-\\[15rem\\]', { state: 'hidden', timeout: 20000 })
  await page.locator('button:has-text("Ajustar escala")').first().click()
  await page.waitForSelector('select[id^="avi-"]', { timeout: 15000 })
  ck('avi: botao Designações AVI', (await page.locator('button:has-text("Designações AVI")').count()) > 0)
  await page.locator('button:has-text("Gerar escala")').first().click()
  // Confirma o modal (se abrir) e espera a geração terminar: o AVI recarrega o
  // setor antes de gerar, então o download só tem sentido depois disso.
  const dlgAvi = page.locator('[role=dialog]')
  if (await dlgAvi.isVisible().catch(() => false)) {
    await dlgAvi.locator('button:has-text("Gerar")').first().click().catch(() => {})
  }
  await page.waitForFunction(
    () => /Escala AVI de .* gerada\.|Designação pronta/.test(document.body.innerText),
    undefined,
    { timeout: 30000 },
  )
  await dialogoBaixarPdf('AVI')
  const limitesAvi = await page.evaluate(async () => {
    const resposta = await fetch('/api/setor/AUDIO_VIDEO', { credentials: 'include' })
    const corpo = await resposta.json()
    const vitor = (corpo.dirigentes ?? []).find((d) => d.nome === 'Vitor AVI')
    const escalas = corpo.dados?.escalas ?? {}
    let maxMes = 0
    let maxDia = 0
    for (const registro of Object.values(escalas)) {
      const porDia = {}
      let noMes = 0
      for (const [slot, id] of Object.entries(registro.auto ?? {})) {
        if (id !== vitor?.id) continue
        noMes += 1
        const iso = String(slot).slice(0, 10)
        porDia[iso] = (porDia[iso] ?? 0) + 1
      }
      maxMes = Math.max(maxMes, noMes)
      for (const n of Object.values(porDia)) maxDia = Math.max(maxDia, n)
    }
    return { maxMes, maxDia, limite: vitor?.limiteMensal ?? null }
  })
  ck(
    'avi: teto mensal do voluntário respeitado',
    limitesAvi.maxMes <= (limitesAvi.limite ?? 3),
    JSON.stringify(limitesAvi),
  )
  ck(
    'avi: uma função por voluntário na mesma reunião',
    limitesAvi.maxDia <= 1,
    JSON.stringify(limitesAvi),
  )
  ck(
    'avi: voluntário no cartão do PDF',
    (await page.locator('[class*="-10000px"] .escala-card:has-text("Vitor AVI")').count()) > 0,
  )
  await shot('11-avi')
  await shotCard('avi')

  // ---------- 12) TPL: voluntários + estrutura + escala manual + PDF ----------
  await page.getByRole('button', { name: 'Voluntários', exact: true }).click()
  await page.waitForSelector('text=Quadro de voluntários', { timeout: 15000 })
  async function novoVoluntarioTpl(nome, verificar = false) {
    await page.locator('button[aria-label="Novo voluntário"]').click()
    // Departamentos primeiro; a ficha do TPL abre em seguida (página, não modal).
    await page.locator('button:has-text("Testemunho Público Local com o carrinho")').click()
    await page.locator('button:has-text("Continuar")').click()
    await page.waitForSelector('#dir-nome', { timeout: 10000 })
    if (verificar) {
      const fichaTpl = page.getByTestId('ficha-voluntario')
      ck(
        'voluntários: ficha TPL só nome',
        (await fichaTpl.getByText('Frequência de designação').count()) === 0 &&
          (await fichaTpl.getByText('Disponibilidade').count()) === 0 &&
          (await fichaTpl.getByText('Dias disponíveis').count()) === 0 &&
          (await fichaTpl.locator('#dir-telefone').count()) === 0,
      )
    }
    await page.fill('#dir-nome', nome)
    await salvarComEspera()
    // A página só volta para a lista quando a ficha persiste.
    await page.waitForSelector('h2:has-text("Quadro de voluntários")', { timeout: 20000 })
    await page.waitForSelector(`article:has-text("${nome}")`, { timeout: 15000 })
  }
  await novoVoluntarioTpl('Ana TPL', true)
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
  await page.locator('[role=dialog] button:has-text("Adicionar horário específico")').click()
  await page.fill('#tpl-periodo-inicio', '09:00')
  await page.fill('#tpl-periodo-fim', '12:00')
  await page.locator('[role=dialog] button:has-text("Salvar")').click()
  // Assim como no ponto: o modal só some quando o período persiste.
  await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 20000 })
  await page.waitForSelector(
    'section:has(h3:text-is("Períodos e dias")) li:has-text("Sexta-Feira")',
    { timeout: 15000 },
  )
  ck(
    'tpl: item cadastrado com menu ⋮ (editar/excluir)',
    (await page.locator('section:has(h3:text-is("Períodos e dias")) button[aria-label^="Opções de"]').count()) > 0,
  )
  ck(
    'tpl: período com horário específico mostra o horário',
    (await page.locator('section:has(h3:text-is("Períodos e dias")) li:has-text("09:00 – 12:00")').count()) > 0,
  )
  await shot('13-tpl-estrutura')

  await page.getByRole('button', { name: 'Designações', exact: true }).click()
  await page.click('button:has-text("Testemunho Público Local")')
  await page.waitForSelector('button:has-text("Ajustar escala")', { timeout: 15000 })
  // Mesma espera ativa do AVI: não troque de mês com o setor ainda carregando.
  await page.waitForSelector('section.h-\\[15rem\\]', { state: 'hidden', timeout: 20000 })
  let temHeroTpl =
    (await page.locator('text=/Próxima designação|Primeira designação/').count()) > 0
  if (!temHeroTpl) {
    // Sem saídas restantes no mês corrente: o mês seguinte sempre tem destaque.
    await page.click('button[aria-label="Próximo mês"]')
    await page.waitForSelector('section.h-\\[15rem\\]', { state: 'hidden', timeout: 20000 })
    temHeroTpl =
      (await page.locator('text=/Próxima designação|Primeira designação/').count()) > 0
  }
  ck('tpl: resumo com hero de designação', temHeroTpl)
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
  await shotCard('tpl')

  // ---------- 13) Links publicos /escala/:slug/:setor ----------
  const info = await page
    .evaluate(() => fetch('/api/auth/eu', { credentials: 'include' }).then((r) => r.json()).catch(() => null))
  const slug =
    info && info.usuario && info.usuario.congregacao && info.usuario.congregacao.slug
  ck('auth/eu expoe slug da congregacao', Boolean(slug), JSON.stringify(info).slice(0, 200))
  if (slug) {
    const proximo = new Date()
    proximo.setMonth(proximo.getMonth() + 1)
    const chaveProximo = `${proximo.getFullYear()}-${proximo.getMonth() + 1}`
    const respostaMes = await page.request.get(
      `${BASE_API}/api/escala/publico/${encodeURIComponent(slug)}/CAMPO?mes=${chaveProximo}`,
    )
    const corpoMes = await respostaMes.json()
    ck(
      'publico CAMPO: link respeita o mês pedido',
      corpoMes.chave === chaveProximo,
      JSON.stringify({ pedido: chaveProximo, recebido: corpoMes.chave }),
    )

    for (const [setor, imagem] of [
      ['CAMPO', 'og-campo.png'],
      ['AVI', 'og-avi.png'],
      ['TPL', 'og-tpl.png'],
    ]) {
      const respostaOg = await page.request.get(
        `${BASE_API}/escala/${encodeURIComponent(slug)}/${setor}`,
      )
      const htmlOg = await respostaOg.text()
      ck(
        `og ${setor}: imagem configurada`,
        htmlOg.includes('property="og:image"') && htmlOg.includes(imagem),
      )
      ck(
        `og ${setor}: og:url sem hash`,
        !/<meta property="og:url"[^>]*#/.test(htmlOg),
      )
    }

    await page.goto(`${BASE}/escala/${encodeURIComponent(slug)}/CAMPO`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('h1:has-text("Programação para serviço de campo")', { timeout: 20000 })
    ck('publico CAMPO: programação abre', true)
    ck(
      'publico CAMPO: aviso Territórios Em breve',
      (await page.getByText('Territórios', { exact: true }).count()) > 0 &&
        (await page.getByText('Em breve', { exact: true }).count()) > 0,
    )
    ck('publico CAMPO: sem chamadas de somente leitura', !(await page.locator('text=/somente leitura/i').count()))
    ck('publico CAMPO: sem botões de download', !(await page.locator('button:has-text("Baixar PDF"), button:has-text("Baixar imagem")').count()))
    if ((await page.locator('.escala-hoje-branco').count()) > 0) {
      ck('publico CAMPO: borda ao vivo de hoje', true)
    }
    ck('publico CAMPO: lista única de próximos dias', (await page.locator('h2:has-text("Próximos dias")').count()) > 0)
    ck('publico CAMPO: sem botões de grupo de dias', (await page.locator('[aria-label="Grupos de dias"]').count()) === 0)
    ck('publico CAMPO: sem botão Ir para o app', (await page.locator('button:has-text("Ir para o app")').count()) === 0)
    await shot('15-publico-campo')

    await page.goto(`${BASE}/escala/${encodeURIComponent(slug)}/AVI`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('text=/Próxima reunião|Primeira reunião|próximas designações|Não há mais reuniões|Nenhuma escala publicada|Não foi possível carregar/', { timeout: 20000 })
    ck('publico AVI: pagina abre', (await page.locator('h1:has-text("Audio/Vídeo & Indicadores")').count()) > 0)
    ck('publico AVI: sem botao de download', !(await page.locator('button:has-text("Baixar PDF"), button:has-text("Baixar imagem")').count()))
    ck('publico AVI: sem botao copiar link', !(await page.locator('button:has-text("Copiar link")').count()))
    ck('publico AVI: sem botao Ir para o app', (await page.locator('button:has-text("Ir para o app")').count()) === 0)
    ck('publico AVI: sem filtro Mês', (await page.locator('#avi-publico-mes').count()) === 0)
    if (await page.locator('article').count()) {
      ck(
        'publico AVI: lista com funções hierarquizadas',
        (await page.locator('article').first().getByText(/operador áudio/i).count()) > 0,
      )
    }
    ck('publico AVI: sem texto Carregando', (await page.locator('text=/Carregando/').count()) === 0)
    await shot('16-publico-avi')

    await page.goto(`${BASE}/escala/${encodeURIComponent(slug)}/TPL`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('text=/Próxima designação|Primeira designação|próximas designações|Ainda não há uma escala|Não há mais saídas|Não foi possível carregar/', { timeout: 20000 })
    ck('publico TPL: pagina abre', (await page.locator('h1:has-text("Testemunho Público Local")').count()) > 0)
    ck('publico TPL: sem filtro Mês', (await page.locator('#tpl-publico-mes').count()) === 0)
    ck('publico TPL: sem texto Carregando', (await page.locator('text=/Carregando/').count()) === 0)
    ck('publico TPL: sem botao de download', !(await page.locator('button:has-text("Baixar PDF"), button:has-text("Baixar imagem")').count()))
    ck('publico TPL: sem botao copiar link', !(await page.locator('button:has-text("Copiar link")').count()))
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
