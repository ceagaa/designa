import type { AptidaoId, Campo, DadosAvi, Dirigente, Usuario } from '../lib/dominio'
import { useEffect, useMemo, useState } from 'react'
import { aptidoesDe, normalizarDadosAvi } from '../lib/avi'
import { carregarSetorExtenso, salvarDadosSetor } from '../lib/authApi'
import CadastroDirigentes from './CadastroDirigentes'

interface TelaPessoasProps {
  usuario: Usuario
  dirigentes: Dirigente[]
  campos: Campo[]
  frequenciaPadrao: string
  ano: number
  mes: number
  efetivas: Record<string, string>
  aoAlterar: (lista: Dirigente[]) => void
  aoConfigurar: () => void
  aoAvisar: (texto: string) => void
}

/**
 * Tela de Voluntários: ficha única por departamento. As designações AVI ficam
 * no cadastro do setor AVI e são editadas aqui pelo administrador.
 */
export default function TelaPessoas({
  usuario,
  dirigentes,
  campos,
  frequenciaPadrao,
  ano,
  mes,
  efetivas,
  aoAlterar,
  aoConfigurar,
  aoAvisar,
}: TelaPessoasProps) {
  const ehAdmin = usuario.papel === 'ADMIN'
  const [avi, setAvi] = useState<DadosAvi | null>(null)
  const [carregando, setCarregando] = useState(ehAdmin)
  const [carregado, setCarregado] = useState(!ehAdmin)

  useEffect(() => {
    if (!ehAdmin || carregado) return undefined
    let vivo = true
    carregarSetorExtenso('AUDIO_VIDEO')
      .then((resposta) => {
        if (vivo) setAvi(normalizarDadosAvi(resposta.dados))
      })
      .catch(() => {
        if (vivo) aoAvisar('Não foi possível carregar as designações do AVI agora.')
      })
      .finally(() => {
        if (!vivo) return
        setCarregado(true)
        setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [ehAdmin, carregado, aoAvisar])

  async function persistirAvi(novo: DadosAvi, anterior: DadosAvi) {
    try {
      await salvarDadosSetor('AUDIO_VIDEO', novo as unknown as Record<string, unknown>)
      setAvi(novo)
    } catch {
      setAvi(anterior)
      aoAvisar('Não foi possível salvar a designação agora.')
    }
  }

  async function definirAptidoes(idIrmao: string, lista: AptidaoId[]) {
    if (!avi) return
    const limpa = [...new Set(lista)]
    const novo: DadosAvi = {
      ...avi,
      aptidoes: { ...avi.aptidoes, [idIrmao]: limpa },
    }
    await persistirAvi(novo, avi)
  }

  function aoAlterarVoluntarios(lista: Dirigente[]) {
    const removidos = dirigentes.filter((d) => !lista.some((x) => x.id === d.id))
    aoAlterar(lista)
    if (!removidos.length || !avi) return

    const alvos = removidos.filter((d) => (avi.aptidoes[d.id] ?? []).length)
    if (!alvos.length) return

    const aptidoes = { ...avi.aptidoes }
    for (const d of alvos) delete aptidoes[d.id]
    const novo = { ...avi, aptidoes }
    setAvi(novo)
    salvarDadosSetor('AUDIO_VIDEO', novo as unknown as Record<string, unknown>).catch(() => {
      setAvi(avi)
      aoAvisar('O voluntário saiu, mas as designações do AVI não puderam ser atualizadas.')
    })
  }

  const aptidoesPorId = useMemo(
    () =>
      avi
        ? Object.fromEntries(dirigentes.map((d) => [d.id, aptidoesDe(avi, d.id)]))
        : null,
    [avi, dirigentes],
  )

  return (
    <div className="space-y-6">
      <CadastroDirigentes
        dirigentes={dirigentes}
        campos={campos}
        frequenciaPadrao={frequenciaPadrao}
        ano={ano}
        mes={mes}
        efetivas={efetivas}
        aoAlterar={aoAlterarVoluntarios}
        aptidoes={aptidoesPorId}
        aoDefinirAptidoes={ehAdmin ? definirAptidoes : undefined}
        aoConfigurar={aoConfigurar}
      />

      {carregando ? (
        <p className="rounded-xl bg-canvas px-3 py-2 text-center text-[13px] text-muted">
          Carregando as designações do AVI…
        </p>
      ) : null}
    </div>
  )
}
