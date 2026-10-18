// API pública do motor.
export { regras, validarRegras, ErroDeConfiguracao, tiposDeEdificio } from './config'
export type { Regras, Custo, Recurso, Verso } from './config'
export { obterMapa, paraCoord, paraPosicao, distanciaManhattan, distanciaACapital, margensDoMapa } from './map'
export type { Mapa, Terreno, Posicao } from './map'
export { novaPartida } from './setup'
export { aplicar } from './actions'
export { casasValidasMontagem, proximaMontagem } from './queries'
export type * from './types'
