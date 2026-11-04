import type { Campo, ConfigEscala } from '../lib/dominio'
import { useState } from 'react'
import { Check, FileText, MapPin } from 'lucide-react'
import { MESES } from '../lib/constants'
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

const HOJE = new Date()
const PROXIMO_MES = HOJE.getMonth() === 11 ? 0 : HOJE.getMonth() + 1

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
    <div className="flex items-center justify-between gap-4 px-1 py-4">
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
}: {
  titulo: string
  descricao?: string
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
        {descricao ? <p className="mt-0.5 text-sm text-muted">{descricao}</p> : null}
      </div>
    </div>
  )
}

interface ConfigCamposProps {
  config: ConfigEscala
  campos: Campo[]
  aoAlterarConfig: (patch: Partial<ConfigEscala>) => void
  aoIrParaPessoas?: () => void
  /** Abre a tela Locais (dias e horários de campo). */
  aoIrParaLocais?: () => void
}

/** Configuração do setor Campo (designação, regras do rodízio, feriados e geração automática). */
export default function ConfigCampos({
  config,
  campos,
  aoAlterarConfig,
  aoIrParaPessoas,
  aoIrParaLocais,
}: ConfigCamposProps) {
  const [editandoCabecalho, setEditandoCabecalho] = useState(false)

  const fixaLigada = config.designacao_fixa === true
  const feriadoLigado = config.ajustar_feriados === true

  return (
    <div className="space-y-6">
      <header>
        <Kicker className="text-teal">Configurações do setor Campo</Kicker>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight text-ink">Campo</h1>
      </header>

      <section className="space-y-2">
        <TituloSecao titulo="Cabeçalho da escala" descricao="Título exibido nas programações do Campo" />
        <div className="divide-y divide-line">
          <Linha
            rotulo="Título da escala"
            descricao={config.titulo}
            acao={
              <Botao variante="secundario" onClick={() => setEditandoCabecalho(true)}>
                <FileText className="size-4" aria-hidden="true" />
                Editar
              </Botao>
            }
          />
        </div>
      </section>

      {aoIrParaLocais ? (
        <section className="space-y-2">
          <TituloSecao
            titulo="Configuração de campos"
            descricao="Dias, horários e locais da designação do Campo"
          />
          <div className="divide-y divide-line">
            <Linha
              rotulo="Dias de campo"
              descricao={
                campos.length
                  ? `${campos.length} configurado${campos.length === 1 ? '' : 's'}, horários e locais`
                  : 'Nenhum dia configurado ainda'
              }
              acao={
                <Botao variante="secundario" className="shrink-0" onClick={aoIrParaLocais}>
                  <MapPin className="size-4" aria-hidden="true" />
                  Abrir
                </Botao>
              }
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <TituloSecao
          titulo="Regras do Rodízio"
          descricao="Critérios inteligentes para a geração automática da escala"
        />
        <div className="divide-y divide-line">
          <Linha
            rotulo="Frequência mensal"
            descricao="Limite 1x, 2x ou 3x definido na ficha de cada voluntário."
            acao={
              aoIrParaPessoas ? (
                <Botao variante="secundario" onClick={aoIrParaPessoas}>
                  Editar fichas
                </Botao>
              ) : null
            }
          />
          <Linha
            rotulo="Evitar dias consecutivos"
            descricao="Garante intervalo de descanso para o mesmo voluntário"
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
                ? 'Cada dia usa o voluntário fixo cadastrado nele.'
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
          <div className="flex flex-wrap items-center gap-3 rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
            <p className="min-w-0 flex-1">
              Nenhum dia tem “Quem dirige” definido: informe o voluntário fixo de cada dia na
              tela Locais.
            </p>
            {aoIrParaLocais ? (
              <Botao variante="fantasma" className="shrink-0 text-crimson" onClick={aoIrParaLocais}>
                Abrir Locais
              </Botao>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <TituloSecao
          titulo="Feriados"
          descricao="Horário especial nos dias de campo que caem em feriado"
        />
        <div className="divide-y divide-line">
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
          titulo="Geração automática"
          descricao="Quando a escala do mês seguinte é criada sozinha"
        />
        <div className="divide-y divide-line">
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

      <Modal
        aberto={editandoCabecalho}
        aoFechar={() => setEditandoCabecalho(false)}
        titulo="Cabeçalho da escala"
        descricao="Título exibido no topo da programação do Campo."
      >
        <div className="space-y-4 px-5 py-4">
          <div>
            <Rotulo htmlFor="cfg-titulo">Título da escala</Rotulo>
            <Input
              id="cfg-titulo"
              value={config.titulo}
              onChange={(e) => aoAlterarConfig({ titulo: e.target.value })}
              placeholder="Ex.: Designação de Campo"
              autoFocus
            />
          </div>
          <Botao
            variante="primario"
            className="w-full"
            onClick={() => setEditandoCabecalho(false)}
          >
            <Check className="size-4" aria-hidden="true" />
            Concluir
          </Botao>
        </div>
      </Modal>
    </div>
  )
}
