import type { Campo, ConfigEscala } from '../lib/dominio'
import { useEffect, useState } from 'react'
import {
  Bell,
  Building2,
  Check,
  ChevronRight,
  FileText,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { MESES } from '../lib/constants'
import type { EstadoNotificacoes, ResultadoAtivacao, ResultadoTestePush } from '../lib/push'
import { ativarNotificacoes, enviarTestePush, estadoNotificacoes } from '../lib/push'
import { Botao, Input, Kicker, Modal, Rotulo, Select, Toggle } from './ui'

/** Horários oferecidos para o feriado: 05:00 às 21:30, de 30 em 30 minutos. */
const HORARIOS_FERIADO: string[] = Array.from({ length: 34 }, (_, i) => {
  const minutos = 5 * 60 + i * 30
  const hora = Math.floor(minutos / 60)
  const resto = minutos % 60
  return `${String(hora).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
})

/** Dias oferecidos para o disparo automático (1–31). */
const DIAS_DISPARO: number[] = Array.from({ length: 31 }, (_, i) => i + 1)

/** Horários do disparo automático: 00:00 às 23:30, de 30 em 30 minutos. */
const HORARIOS_DISPARO: string[] = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
)

/** Data de hoje resolvida uma vez (oxlint: sem Date instável no render). */
const HOJE = new Date()
const ATUALIZADO = `em ${MESES[HOJE.getMonth()]} de ${HOJE.getFullYear()}`
const PROXIMO_MES = HOJE.getMonth() === 11 ? 0 : HOJE.getMonth() + 1

function textoTeste(resultado: ResultadoTestePush): string {
  if (resultado.erro === 'nao_configurado') {
    return 'Falta configurar as chaves de push no servidor (PUSH_VAPID_PUBLICA / PUSH_VAPID_PRIVADA).'
  }
  if (resultado.erro === 'pin_invalido') return 'PIN incorreto — tente novamente.'
  if (resultado.erro) return 'Não foi possível enviar o teste agora. Tente de novo.'
  const enviadas = resultado.enviadas ?? 0
  const removidas = resultado.removidas ?? 0
  const falhas = resultado.falhas ?? 0
  if (enviadas === 0 && falhas === 0 && removidas === 0) {
    return 'Nenhum aparelho inscrito — ative as notificações primeiro.'
  }
  const partes = [`Teste enviado para ${enviadas} aparelho(s)`]
  if (removidas > 0) partes.push(`${removidas} desativado(s)`)
  if (falhas > 0) partes.push(`${falhas} falha(s)`)
  return `${partes.join(' • ')}.`
}

function Linha({
  rotulo,
  descricao,
  children,
  acao,
}: {
  rotulo: string
  descricao?: string
  children?: React.ReactNode
  acao?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0 pr-1">
        <p className="text-sm font-semibold text-ink">{rotulo}</p>
        {descricao ? <p className="mt-0.5 text-[13px] text-muted">{descricao}</p> : null}
        {children ? <div className="mt-1.5">{children}</div> : null}
      </div>
      {acao}
    </div>
  )
}

function TituloSecao({
  titulo,
  descricao,
  badge,
}: {
  titulo: string
  descricao?: string
  badge?: string
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
        {descricao ? <p className="mt-0.5 text-sm text-muted">{descricao}</p> : null}
      </div>
      {badge ? <span className="shrink-0 text-xs font-bold text-muted">{badge}</span> : null}
    </div>
  )
}

interface CompartilharProps {
  icone: React.ReactNode
  caixa: string
  titulo: string
  descricao: string
  onClick?: () => void
  desabilitado?: boolean
}

function ItemCompartilhar({
  icone,
  caixa,
  titulo,
  descricao,
  onClick,
  desabilitado,
}: CompartilharProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      className={`flex w-full items-center justify-between gap-3 rounded-xl bg-card p-4 text-left shadow-sm transition-colors ${
        desabilitado ? 'cursor-not-allowed opacity-70' : 'active:bg-canvas'
      }`}
    >
      <span className="flex min-w-0 items-center gap-3.5">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${caixa}`}
          aria-hidden="true"
        >
          {icone}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-ink">{titulo}</span>
          <span className="truncate text-[13px] text-muted">{descricao}</span>
        </span>
      </span>
      {desabilitado ? (
        <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-ink-soft">
          Em breve
        </span>
      ) : (
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
      )}
    </button>
  )
}

interface ConfigCamposProps {
  config: ConfigEscala
  campos: Campo[]
  aoAlterarConfig: (patch: Partial<ConfigEscala>) => void
  aoExportar: () => void
  aoCopiarLink: () => void
}

export default function ConfigCampos({
  config,
  campos,
  aoAlterarConfig,
  aoExportar,
  aoCopiarLink,
}: ConfigCamposProps) {
  const [editandoCong, setEditandoCong] = useState(false)
  const [push, setPush] = useState<EstadoNotificacoes | null>(null)
  const [pushOcupado, setPushOcupado] = useState(false)
  const [pushMensagem, setPushMensagem] = useState<string | null>(null)
  const [testeOcupado, setTesteOcupado] = useState(false)
  const [testeMensagem, setTesteMensagem] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    estadoNotificacoes().then((estado) => {
      if (vivo) setPush(estado)
    })
    return () => {
      vivo = false
    }
  }, [])

  async function aoAtivarPush() {
    setPushOcupado(true)
    setPushMensagem(null)
    const resultado = await ativarNotificacoes()
    const textos: Record<ResultadoAtivacao, string> = {
      ativo: 'Pronto! Este aparelho já recebe notificações da escala.',
      aguardando_servidor:
        'Permissão concedida. Falta configurar as chaves de push no servidor (PUSH_VAPID_PUBLICA).',
      bloqueado: 'Notificações bloqueadas — libere-as nas configurações do navegador.',
      incompativel: 'Este navegador não suporta notificações.',
      erro: 'Não foi possível ativar agora. Tente de novo.',
    }
    setPushMensagem(textos[resultado])
    setPush(await estadoNotificacoes())
    setPushOcupado(false)
  }

  async function aoEnviarTeste() {
    setTesteOcupado(true)
    setTesteMensagem(null)
    const resultado = await enviarTestePush()
    setTesteMensagem(textoTeste(resultado))
    setTesteOcupado(false)
  }

  const fixaLigada = config.designacao_fixa === true
  const feriadoLigado = config.ajustar_feriados === true

  return (
    <div className="space-y-6">
      <header>
        <Kicker className="text-muted">Ajustes do sistema</Kicker>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight text-ink">Configurações</h1>
      </header>

      <div className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal">
              <Building2 className="size-6" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-ink">
                {config.congregacao || config.titulo || 'Minha congregação'}
              </span>
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <span className="truncate text-[13px] text-muted">{config.titulo}</span>
                <span className="text-[10px] text-muted" aria-hidden="true">
                  •
                </span>
                <span className="shrink-0 rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-bold text-success">
                  Em uso
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Editar congregação"
            onClick={() => setEditandoCong(true)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-teal-tint hover:text-teal"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              <path
                d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <section className="space-y-2">
        <TituloSecao
          titulo="Regras do Rodízio"
          descricao="Critérios inteligentes para a geração automática da escala"
        />
        <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
          <Linha
            rotulo="Evitar dias consecutivos"
            descricao="Garante intervalo de descanso para o mesmo dirigente"
            acao={
              <Toggle
                rotulo="Evitar dias consecutivos"
                checked={config.evitar_consecutivos !== false}
                aoMudar={(valor) => aoAlterarConfig({ evitar_consecutivos: valor })}
              />
            }
          />
          <Linha
            rotulo="Equilibrar fins de semana"
            descricao="Distribui saídas de sábado e domingo de forma equitativa"
            acao={
              <Toggle
                rotulo="Equilibrar fins de semana"
                checked={config.equilibrar_fds !== false}
                aoMudar={(valor) => aoAlterarConfig({ equilibrar_fds: valor })}
              />
            }
          />
          <Linha
            rotulo="Designação fixa"
            descricao={
              fixaLigada
                ? 'Cada dia usa a pessoa fixa cadastrada nele.'
                : 'Distribui conforme a frequência de cada ficha.'
            }
            acao={
              <Toggle
                rotulo="Designação fixa"
                checked={fixaLigada}
                aoMudar={(valor) => aoAlterarConfig({ designacao_fixa: valor })}
              />
            }
          />
        </div>
        {fixaLigada && !campos.some((c) => c.fixo) ? (
          <p className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
            Nenhum dia tem “Quem dirige” definido: informe a pessoa fixa de cada dia na aba Locais.
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <TituloSecao
          titulo="Feriados"
          descricao="Horário especial nos dias de campo que caem em feriado"
        />
        <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
          <Linha
            rotulo="Ajustar horário nos feriados"
            descricao={
              feriadoLigado
                ? `Os feriados passam a sair às ${config.horario_feriado}.`
                : 'Mantém o horário regular do dia.'
            }
            acao={
              <Toggle
                rotulo="Ajustar horário nos feriados"
                checked={feriadoLigado}
                aoMudar={(valor) => aoAlterarConfig({ ajustar_feriados: valor })}
              />
            }
          />
          {feriadoLigado ? (
            <Linha
              rotulo="Horário dos feriados"
              descricao="Passa a valer em todos os feriados da escala"
              acao={
                <Select
                  aria-label="Horário dos feriados"
                  className="w-28"
                  value={config.horario_feriado}
                  onChange={(e) => aoAlterarConfig({ horario_feriado: e.target.value })}
                >
                  {HORARIOS_FERIADO.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              }
            />
          ) : null}
        </div>
      </section>

      <section className="space-y-2">
        <TituloSecao
          titulo="Compartilhamento"
          descricao="Distribuição oficial da escala para o grupo"
        />
        <div className="flex flex-col gap-2">
          <ItemCompartilhar
            icone={<FileText className="size-6" />}
            caixa="bg-teal-tint text-teal"
            titulo="Gerar PDF da Escala Mensal"
            descricao="Quadro de avisos em formato A4"
            onClick={aoExportar}
          />
          <ItemCompartilhar
            icone={<Send className="size-6" />}
            caixa="bg-success-bg text-success"
            titulo="Aviso por WhatsApp"
            descricao="Copie o link da escala e envie ao grupo"
            onClick={aoCopiarLink}
          />
          <ItemCompartilhar
            icone={<RefreshCw className="size-6" />}
            caixa="bg-[#e6f7fb] text-[#006877]"
            titulo="Sincronizar Google Agenda"
            descricao="Feed de calendário em tempo real"
            desabilitado
          />
        </div>
      </section>

      <section className="space-y-2">
        <TituloSecao
          titulo="Geração automática"
          descricao="Quando a escala do mês seguinte é criada sozinha"
        />
        <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
          <Linha
            rotulo="Dia do disparo"
            descricao={`Todo mês no dia ${config.disparo_dia}, às ${config.disparo_hora} (horário de São Paulo)`}
            acao={
              <Select
                aria-label="Dia do disparo"
                className="w-24"
                value={String(config.disparo_dia)}
                onChange={(e) => aoAlterarConfig({ disparo_dia: Number(e.target.value) })}
              >
                {DIAS_DISPARO.map((dia) => (
                  <option key={dia} value={dia}>
                    {dia}
                  </option>
                ))}
              </Select>
            }
          />
          <Linha
            rotulo="Horário do disparo"
            descricao="A escala entra sozinha e os aparelhos inscritos recebem um aviso"
            acao={
              <Select
                aria-label="Horário do disparo"
                className="w-28"
                value={config.disparo_hora}
                onChange={(e) => aoAlterarConfig({ disparo_hora: e.target.value })}
              >
                {HORARIOS_DISPARO.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            }
          />
        </div>
        <p className="rounded-xl border-l-2 border-teal bg-teal-tint px-3 py-2 text-[13px] text-ink">
          A escala de {MESES[PROXIMO_MES]} será gerada no dia {config.disparo_dia}, às{' '}
          {config.disparo_hora}, e os aparelhos receberão um aviso.
        </p>
      </section>

      <section className="space-y-2">
        <TituloSecao titulo="Notificações" descricao="Avisos no aparelho mesmo com o app fechado" />
        <div className="rounded-xl bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal"
              aria-hidden="true"
            >
              <Bell className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Notificações push</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {!push
                  ? 'Verificando este aparelho…'
                  : !push.suporta
                    ? 'Este navegador não suporta notificações.'
                    : push.inscrito
                      ? 'Ativo neste aparelho.'
                      : push.permissao === 'denied'
                        ? 'Bloqueadas — libere nas configurações do navegador.'
                        : 'Ative para receber avisos da escala no aparelho.'}
              </p>
              {pushMensagem ? (
                <p className="mt-1.5 text-[12px] font-semibold text-teal">{pushMensagem}</p>
              ) : null}
            </div>
          </div>
          <Botao
            variante="primario"
            className="mt-3 w-full"
            disabled={!push?.suporta || push?.inscrito === true || pushOcupado}
            onClick={aoAtivarPush}
          >
            <Bell className="size-4" aria-hidden="true" />
            {push?.inscrito ? 'Notificações ativadas' : 'Ativar notificações'}
          </Botao>
          <Botao
            variante="secundario"
            className="mt-2 w-full"
            disabled={pushOcupado || testeOcupado}
            onClick={aoEnviarTeste}
          >
            <Send className="size-4" aria-hidden="true" />
            {testeOcupado ? 'Enviando teste…' : 'Enviar teste'}
          </Botao>
          {testeMensagem ? (
            <p className="mt-2 text-[12px] font-semibold text-teal">{testeMensagem}</p>
          ) : null}
        </div>
      </section>

      <footer className="flex flex-col items-center gap-1 pb-4 pt-2 text-center">
        <span className="mb-1 flex size-8 items-center justify-center rounded-full bg-teal-tint text-teal">
          <ShieldCheck className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-ink">Dirigentes</span>
        <span className="text-[11px] font-semibold text-muted">
          {config.congregacao ? `${config.congregacao} • ` : ''}Atualizado {ATUALIZADO}
        </span>
      </footer>

      <Modal
        aberto={editandoCong}
        aoFechar={() => setEditandoCong(false)}
        titulo="Cabeçalho da escala"
        descricao="Aparece no topo da programação e em toda a exportação em PDF e imagem."
        largura="max-w-lg"
      >
        <div className="space-y-4 px-5 py-4">
          <div>
            <Rotulo htmlFor="cfg-cong">Congregação / Campo</Rotulo>
            <Input
              id="cfg-cong"
              value={config.congregacao}
              onChange={(e) => aoAlterarConfig({ congregacao: e.target.value })}
              placeholder="Ex.: São João do Paraíso"
              autoCapitalize="words"
              enterKeyHint="next"
              autoFocus
            />
          </div>
          <div>
            <Rotulo htmlFor="cfg-titulo">Título da escala</Rotulo>
            <Input
              id="cfg-titulo"
              value={config.titulo}
              onChange={(e) => aoAlterarConfig({ titulo: e.target.value })}
              placeholder="Ex.: Designação de Campo"
              enterKeyHint="done"
            />
          </div>
          <Botao variante="primario" className="w-full" onClick={() => setEditandoCong(false)}>
            <Check className="size-4" aria-hidden="true" />
            Concluir
          </Botao>
        </div>
      </Modal>
    </div>
  )
}
