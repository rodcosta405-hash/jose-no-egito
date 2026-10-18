// Web Worker: roda a simulação comparativa fora da tela, para a interface não travar.
import { simular, type ResultadoSimulacao } from '../../bots/simulacao'
import { regras as regrasPadrao, validarRegras } from '../../engine'

export interface PedidoSimulacao {
  mesa: string[]
  partidas: number
  semente: number
  regrasEditadas: unknown
}

export type RespostaSimulacao =
  | { tipo: 'progresso'; feitas: number; total: number }
  | { tipo: 'resultado'; padrao: ResultadoSimulacao; editado: ResultadoSimulacao }
  | { tipo: 'erro'; mensagem: string }

const ctx = self as unknown as { postMessage(m: RespostaSimulacao): void; onmessage: ((ev: MessageEvent<PedidoSimulacao>) => void) | null }

ctx.onmessage = (ev) => {
  const { mesa, partidas, semente, regrasEditadas } = ev.data
  try {
    const r = validarRegras(regrasEditadas)
    const total = partidas * 2
    let ultimo = 0
    const avisar = (feitas: number) => {
      if (feitas - ultimo >= 5 || feitas === total) {
        ultimo = feitas
        ctx.postMessage({ tipo: 'progresso', feitas, total })
      }
    }
    // As mesmas sementes nas duas versões: a diferença vem só das regras.
    const padrao = simular(mesa, partidas, semente, regrasPadrao, (k) => avisar(k))
    const editado = simular(mesa, partidas, semente, r, (k) => avisar(partidas + k))
    ctx.postMessage({ tipo: 'resultado', padrao, editado })
  } catch (e) {
    ctx.postMessage({ tipo: 'erro', mensagem: (e as Error).message })
  }
}
