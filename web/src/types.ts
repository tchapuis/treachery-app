// Mirrors the Go wire format in room.go.
export type Rarity = 'U' | 'R' | 'M' | 'S'
export type Role = 'Leader' | 'Traitor' | 'Assassin' | 'Guardian'

export interface Card {
  id: number
  name: string
  role: Role
  rarity: Rarity
  artist: string
}

// code is a translation key suffix, see error_* in i18n.ts
export interface AppError {
  code: string
  params?: Record<string, string | number>
}

export interface Settings {
  playerCount: number
  rarities: Rarity[]
}

export interface PlayerView {
  id: string
  name: string
  ready: boolean
  connected: boolean
  // set only for an unveiled player: a face-up identity is public. The Leader is unveiled at the draw.
  card?: Card
}

export interface RoomView {
  type: 'room'
  code: string
  phase: 'lobby' | 'playing'
  hostId: string
  settings: Settings
  players: PlayerView[]
}

export type ServerMsg =
  | { type: 'welcome'; code: string; playerId: string; token: string }
  | RoomView
  | { type: 'you'; role: Role; card: Card }
  | { type: 'error'; error: AppError }
  | { type: 'kicked' }

export type ClientMsg =
  | { type: 'create'; nickname: string; playerCount: number; rarities: Rarity[] }
  | { type: 'join'; code: string; nickname: string }
  | { type: 'resume'; code: string; token: string }
  | { type: 'ready'; value: boolean }
  | { type: 'start' }
  | { type: 'unveil' }
  | { type: 'reset' }
  | { type: 'leave' }
  | { type: 'kick'; playerId: string }
  | { type: 'transferHost'; playerId: string }

// GET /api/catalog; distribution is keyed by player count, in roleOrder.
export interface Catalog {
  cards: Card[]
  distribution: Record<string, [number, number, number, number]>
}
export const roleOrder: Role[] = ['Leader', 'Traitor', 'Assassin', 'Guardian']
