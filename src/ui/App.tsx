import { useState } from 'react'
import { Mesa } from './Mesa'
import { NovaPartida } from './NovaPartida'
import { TelaReproducao } from './Reproducao'
import { temPartidaSalva, useJogo } from './useJogo'
import './estilos.css'

export function App() {
  const jogo = useJogo()
  const [reproduzindo, setReproduzindo] = useState(false)
  if (reproduzindo) return <TelaReproducao aoVoltar={() => setReproduzindo(false)} />
  if (!jogo.sessao)
    return (
      <NovaPartida
        aoComecar={(e) => jogo.comecar(e)}
        salvaExiste={temPartidaSalva()}
        aoContinuar={jogo.continuarSalva}
        aoReproduzir={() => setReproduzindo(true)}
      />
    )
  return <Mesa jogo={jogo} />
}
