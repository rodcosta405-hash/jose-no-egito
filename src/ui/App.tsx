import { regras } from '../engine'

export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <h1>José no Egito</h1>
      <p>Protótipo para playtest. Regras carregadas: {regras.versao}.</p>
    </main>
  )
}
