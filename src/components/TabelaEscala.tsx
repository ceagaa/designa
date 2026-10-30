import type { RefObject } from 'react'
import type { Campo, ConfigEscala, Dirigente, Ocorrencia, RegistroMes } from '../lib/dominio'
import { Eraser } from 'lucide-react'
import { infoDia, MESES } from '../lib/constants'
import { Botao } from './ui'
import EscalaCard from './EscalaCard'

interface TabelaEscalaProps {
  ano: number
  mes: number
  config: ConfigEscala
  dirigentes: Dirigente[]
  campos: Campo[]
  ocorrencias: Ocorrencia[]
  ocorrenciasAtivas: Ocorrencia[]
  registro: RegistroMes
  efetivas: Record<string, string>
  efetivasAjudante: Record<string, string>
  manterManuais: boolean
  aoAlterarManter: (valor: boolean) => void
  aoAlterarDesignacao: (chaves: string[], idDirigente: string) => void
  aoAlterarAjudante: (chaves: string[], idDirigente: string) => void
  aoAlternarRemocao: (chave: string, remover: boolean) => void
  aoLimparManuais: () => void
  aoConfigurar: () => void
  aoCadastrar: () => void
  cardRef: RefObject<HTMLDivElement | null>
}

export default function TabelaEscala({
  ano,
  mes,
  config,
  dirigentes,
  campos,
  ocorrencias,
  ocorrenciasAtivas,
  registro,
  efetivas,
  efetivasAjudante,
  manterManuais,
  aoAlterarManter,
  aoAlterarDesignacao,
  aoAlterarAjudante,
  aoAlternarRemocao,
  aoLimparManuais,
  aoConfigurar,
  aoCadastrar,
  cardRef,
}: TabelaEscalaProps) {
  const manuais = registro.manuais ?? {}
  const totalManuais = Object.keys(manuais).length
  const removidas = registro.removidas ?? {}
  const designados = ocorrenciasAtivas.filter((o) => efetivas[o.key]).length
  const semDesignacao = ocorrenciasAtivas.length - designados
  const totalRemovidas = Object.values(removidas).filter(Boolean).length
  const semCampos = !campos.length
  const semDirigentes = !dirigentes.length

  return (
    <div className="space-y-4">
      {/* Cabeçalho: título + mês/ano herdado da tela anterior (sem filtro próprio). */}
      <div className="border border-line bg-paper px-4 py-3">
        <h1 className="font-display text-lg leading-tight text-ink">Tabela completa</h1>
        <p className="text-[13px] text-muted">{MESES[mes]} de {ano}</p>
      </div>

      {/* Estatísticas do mês */}
      <p aria-live="polite" className="flex flex-wrap gap-x-4 gap-y-1 border border-line bg-canvas px-4 py-2.5 text-sm text-muted">
        <span>
          <strong className="text-ink">{ocorrencias.length}</strong> dia
          {ocorrencias.length === 1 ? '' : 's'} de campo
        </span>
        <span>
          <strong className="text-ink">{designados}</strong> designado
          {designados === 1 ? '' : 's'}
        </span>
        <span className={semDesignacao ? 'font-semibold text-crimson' : ''}>
          <strong className={semDesignacao ? 'text-crimson' : 'text-ink'}>{semDesignacao}</strong>{' '}
          sem designação
        </span>
        <span>
          <strong className="text-ink">{totalRemovidas}</strong>{' '}
          removido{totalRemovidas === 1 ? '' : 's'}
        </span>
        {totalManuais ? (
          <span>
            <strong className="text-ink">{totalManuais}</strong> ajuste
            {totalManuais === 1 ? '' : 's'} manual{totalManuais === 1 ? '' : 'is'}
          </span>
        ) : null}
      </p>

      {/* Preferência de geração */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-line bg-paper px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={manterManuais}
            onChange={(e) => aoAlterarManter(e.target.checked)}
            className="size-4 accent-[#045A6C]"
          />
          <span className="font-semibold text-ink">Manter ajustes manuais ao gerar</span>
        </label>
        {totalManuais ? (
          <Botao variante="fantasma" onClick={aoLimparManuais}>
            <Eraser className="size-4" />
            Limpar manuais
          </Botao>
        ) : null}
      </div>

      {semCampos || semDirigentes ? (
        <div className="border border-dashed border-line bg-paper px-6 py-10 text-center">
          <p className="mx-auto max-w-md text-sm text-muted">
            {semCampos
              ? 'A escala precisa de dias de campo. Defina dia da semana, horário e ponto de encontro para começar.'
              : 'Cadastre pelo menos um voluntário ativo do Campo para que o rodízio encontre alguém designado.'}
          </p>
          <Botao
            variante="primario"
            className="mt-4"
            onClick={semCampos ? aoConfigurar : aoCadastrar}
          >
            {semCampos ? 'Configurar dias de campo' : 'Cadastrar voluntários'}
          </Botao>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-[13px] text-muted sm:hidden">
            Deslize para a lateral para ver a escala inteira →
          </p>
          <div className="scroll-hint overflow-x-auto pb-2">
            <EscalaCard
              ref={cardRef}
              config={config}
              ocorrencias={ocorrenciasAtivas}
              dirigentes={dirigentes}
              designacoes={efetivas}
              manuais={manuais}
              ajudantes={efetivasAjudante}
              manuaisAjudante={registro.manuaisAjudante ?? {}}
              aoAlterarDesignacao={aoAlterarDesignacao}
              aoAlterarAjudante={aoAlterarAjudante}
            />
          </div>
        </div>
      )}

      {ocorrenciasAtivas.length && !semDesignacao ? (
        <p className="text-[13px] text-muted">
          Todos os dias ativos têm voluntário. O PDF e o link já estão disponíveis.
        </p>
      ) : null}

      {ocorrenciasAtivas.length && semDesignacao ? (
        <p className="text-[13px] text-muted">
          Troque qualquer nome direto na tabela — a linha marcada com o ponto ficou definida à mão
          e não muda na próxima geração.
        </p>
      ) : null}

      {ocorrencias.length ? (
        <section className="space-y-2 border-t border-line pt-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Dias da programação</h2>
            <p className="mt-0.5 text-[13px] text-muted">
              Remova uma data sem apagar o dia semanal. Você pode restaurá-la antes de gerar.
            </p>
          </div>
          <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
            {ocorrencias.map((ocorrencia) => {
              const removida = Boolean(removidas[ocorrencia.key])
              return (
                <div
                  key={ocorrencia.key}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${removida ? 'text-muted line-through' : 'text-ink'}`}>
                      {infoDia(ocorrencia.diaSemana).nome} · {ocorrencia.dia}/
                      {String(mes + 1).padStart(2, '0')}
                    </p>
                    <p className="truncate text-[12px] text-muted">
                      {ocorrencia.campo.horario} · {ocorrencia.campo.local}
                    </p>
                  </div>
                  <Botao
                    variante={removida ? 'secundario' : 'fantasma'}
                    className="shrink-0"
                    aria-label={`${removida ? 'Restaurar' : 'Remover'} ${infoDia(ocorrencia.diaSemana).nome} ${ocorrencia.dia}/${String(mes + 1).padStart(2, '0')}`}
                    onClick={() => aoAlternarRemocao(ocorrencia.key, !removida)}
                  >
                    {removida ? 'Restaurar' : 'Remover dia'}
                  </Botao>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}
