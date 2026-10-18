import { Mesa } from './Mesa'
import { NovaPartida } from './NovaPartida'
import { temPartidaSalva, useJogo } from './useJogo'
import './estilos.css'

export function App() {
  const jogo = useJogo()
  if (!jogo.sessao) return <NovaPartida aoComecar={(e) => jogo.comecar(e)} salvaExiste={temPartidaSalva()} aoContinuar={jogo.continuarSalva} />
  return <Mesa jogo={jogo} />
}
