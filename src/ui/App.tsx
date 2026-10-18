import { useState } from 'react'
import { regras as regrasPadrao } from '../engine'
import type { Regras } from '../engine'
import { Designer } from './designer/Designer'
import { Mesa } from './Mesa'
import { NovaPartida } from './NovaPartida'
import { TelaReproducao } from './Reproducao'
import { temPartidaSalva, useJogo } from './useJogo'
import './estilos.css'

type Tela = 'inicio' | 'reproduzir' | 'designer'

export function App() {
  const jogo = useJogo()
  const [tela, setTela] = useState<Tela>('inicio')
  // Regras da próxima partida: as padrão, ou as que o designer mandou jogar.
  const [regrasDaPartida, setRegrasDaPartida] = useState<Regras>(regrasPadrao)

  if (tela === 'reproduzir') return <TelaReproducao aoVoltar={() => setTela('inicio')} />
  if (tela === 'designer')
    return (
      <Designer
        aoVoltar={() => setTela('inicio')}
        aoJogar={(r) => {
          setRegrasDaPartida(r)
          setTela('inicio')
          jogo.irParaMenu()
        }}
      />
    )
  if (!jogo.sessao)
    return (
      <NovaPartida
        aoComecar={(e) => jogo.comecar(e)}
        salvaExiste={temPartidaSalva()}
        aoContinuar={jogo.continuarSalva}
        aoReproduzir={() => setTela('reproduzir')}
        aoDesigner={() => setTela('designer')}
        regras={regrasDaPartida}
        aoUsarPadrao={() => setRegrasDaPartida(regrasPadrao)}
      />
    )
  return <Mesa jogo={jogo} />
}
