import type { ConfigEscala, Dirigente, Ocorrencia } from './dominio'
import { CITACAO, nomeDiaCurto } from './constants'
import { lerChaveMes, nomeMes } from './datas'

async function carregarHtml2canvas(): Promise<typeof import('html2canvas').default> {
  const { default: html2canvas } = await import('html2canvas')
  return html2canvas
}

/** Qualquer nó renderizável pelo html2canvas (div, section, canvas…). */
export type AlvoCaptura = HTMLElement | HTMLCanvasElement

function nomeArquivo(chave: string, prefixo = 'designacao'): string {
  const { ano, mes } = lerChaveMes(chave)
  return `${prefixo}-${nomeMes(mes).toLowerCase()}-${ano}`
}

/** Renderiza o card da escala exatamente como está na tela. */
export async function capturarNo(no: AlvoCaptura | null): Promise<HTMLCanvasElement> {
  if (!no) throw new Error('Card da escala não encontrado.')

  const html2canvas = await carregarHtml2canvas()
  await (document.fonts?.ready ?? Promise.resolve())

  // Troca os dropdowns pelos nomes em texto para a exportação sair como planilha.
  no.classList.add('capturando')
  try {
    return await html2canvas(no, {
      backgroundColor: '#FFFFFF',
      scale: 2,
      useCORS: true,
      logging: false,
      imageTimeout: 15000,
    })
  } finally {
    no.classList.remove('capturando')
  }
}

function paraArquivo(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))), 'image/png')
  })
}

export async function baixarImagem(
  alvo: AlvoCaptura | null,
  chave: string,
  prefixo?: string,
): Promise<HTMLCanvasElement> {
  const canvas = alvo instanceof HTMLCanvasElement ? alvo : await capturarNo(alvo)
  const blob = await paraArquivo(canvas)
  baixar(blob, `${nomeArquivo(chave, prefixo)}.png`)
  return canvas
}

/**
 * Gera o PDF em A4 retrato (fit 1x1, igual à planilha base), sempre em
 * página única: se a prévia for mais alta que o espaço útil, ela é reduzida
 * (largura e altura) até caber. Margens 6 mm laterais / 5 mm verticais.
 */
export async function baixarPdf(
  alvo: AlvoCaptura | null,
  chave: string,
  prefixo?: string,
): Promise<HTMLCanvasElement> {
  const canvas = alvo instanceof HTMLCanvasElement ? alvo : await capturarNo(alvo)
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const larguraPag = pdf.internal.pageSize.getWidth()
  const alturaPag = pdf.internal.pageSize.getHeight()
  const margemX = 6
  const margemY = 5
  const larguraDisp = larguraPag - margemX * 2
  const alturaDisp = alturaPag - margemY * 2

  let largura = larguraDisp
  let altura = (canvas.height * largura) / canvas.width
  if (altura > alturaDisp) {
    largura = (largura * alturaDisp) / altura
    altura = alturaDisp
  }

  const dados = canvas.toDataURL('image/jpeg', 0.95)
  const x = (larguraPag - largura) / 2
  const y = (alturaPag - altura) / 2
  pdf.addImage(dados, 'JPEG', x, y, largura, altura)

  pdf.save(`${nomeArquivo(chave, prefixo)}.pdf`)
  return canvas
}

function tituloDaEscala(chave: string): string {
  const { ano, mes } = lerChaveMes(chave)
  return `Designação de ${nomeMes(mes)} de ${ano}`
}

/** Abre o menu nativo do sistema (WhatsApp, etc.). Sem suporte, copia o texto. */
export async function compartilhar({
  canvas,
  chave,
  texto,
  prefixo,
  titulo,
}: {
  canvas: HTMLCanvasElement
  chave: string
  texto: string
  prefixo?: string
  titulo?: string
}): Promise<'arquivo' | 'texto' | 'copiado'> {
  const blob = await paraArquivo(canvas)
  const arquivo = new File([blob], `${nomeArquivo(chave, prefixo)}.png`, { type: 'image/png' })
  const tituloFinal = titulo ?? tituloDaEscala(chave)

  if (navigator.canShare?.({ files: [arquivo] })) {
    await navigator.share({ files: [arquivo], title: tituloFinal, text: texto })
    return 'arquivo'
  }

  if (navigator.share) {
    await navigator.share({ title: tituloFinal, text: texto })
    return 'texto'
  }

  await copiarTexto(texto)
  return 'copiado'
}

export async function copiarTexto(texto: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto)
    return
  }

  const area = document.createElement('textarea')
  area.value = texto
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

export interface EntradaTexto {
  config: ConfigEscala
  chave: string
  ocorrencias: Ocorrencia[]
  designacoes: Record<string, string>
  dirigentes: Dirigente[]
}

/** Resumo em texto pronto para colar no WhatsApp. */
export function textoSimplificado({ config, chave, ocorrencias, designacoes, dirigentes }: EntradaTexto): string {
  const { ano, mes } = lerChaveMes(chave)
  const porId = new Map(dirigentes.map((d) => [d.id, d]))
  const linhas = [
    `*${config.titulo}*`,
    `${config.congregacao} — ${nomeMes(mes)} de ${ano}`,
    '',
  ]

  if (!ocorrencias.length) {
    linhas.push('Nenhum dia de campo configurado para este mês.')
  }

  for (const oc of ocorrencias) {
    const id = designacoes[oc.key]
    const dirigente = porId.get(id)
    const dia = nomeDiaCurto(oc.diaSemana)
    const nome = dirigente ? dirigente.nome : 'Sem designação'
    linhas.push(
      `*${dia}, ${oc.iso.slice(8, 10)}/${oc.iso.slice(5, 7)}* — ${oc.campo.horario} — ${oc.campo.local}`,
      `> ${nome}`,
      '',
    )
  }

  linhas.push(`_${CITACAO}_`)
  return linhas.join('\n')
}

function baixar(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
