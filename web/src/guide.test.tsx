import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { clearCatalogCache } from './catalog'
import { FakeSocket } from './test/fakeSocket'
import type { Card, Catalog, RoomView } from './types'

const cards: Card[] = [
  { id: 62, name: 'The Void Tyrant', role: 'Leader', rarity: 'M', artist: 'A' },
  { id: 7, name: 'The Oracle', role: 'Guardian', rarity: 'U', artist: 'B' },
  { id: 59, name: 'The Puppet Master', role: 'Traitor', rarity: 'S', artist: 'C' },
  { id: 40, name: 'The Banisher', role: 'Traitor', rarity: 'U', artist: 'D' },
]
const catalog: Catalog = {
  cards,
  distribution: { '4': [1, 1, 2, 0], '5': [1, 1, 2, 1], '6': [1, 1, 3, 1], '7': [1, 1, 3, 2], '8': [1, 2, 3, 2] },
}

function stubFetch(ok = true) {
  const fetch = vi.fn(async () => (ok ? new Response(JSON.stringify(catalog)) : new Response('', { status: 500 })))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

beforeEach(() => {
  clearCatalogCache()
  FakeSocket.all = []
  vi.stubGlobal('WebSocket', FakeSocket)
  localStorage.clear()
})

afterEach(() => vi.unstubAllGlobals())

describe('Guide', () => {
  it('shows the role distribution table in the rules', async () => {
    stubFetch()
    render(<App />)
    fireEvent.click(screen.getByText('Rules'))
    const row = (await screen.findByText('8')).closest('tr')!
    expect([...row.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['1', '2', '3', '2'])
  })

  it('groups cards by role, then by rarity', async () => {
    stubFetch()
    render(<App />)
    fireEvent.click(screen.getByText('Cards'))
    const traitorSpecial = await screen.findByRole('region', { name: 'Traitor Special' })
    expect(within(traitorSpecial).getByAltText('The Puppet Master')).toBeTruthy()
    expect(within(traitorSpecial).queryByAltText('The Banisher')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Guardian Special' })).toBeNull()

    fireEvent.click(within(traitorSpecial).getByRole('button'))
    expect(screen.getByText('059/062 · s · ill. C')).toBeTruthy()
  })

  it('keeps the game and its socket while the guide is open', async () => {
    stubFetch()
    const room: RoomView = {
      type: 'room',
      code: 'ABCD',
      phase: 'playing',
      hostId: 'p1',
      settings: { playerCount: 4, rarities: ['U'] },
      players: [{ id: 'p1', name: 'Alice', ready: true, connected: true, card: cards[0] }],
    }
    render(<App />)
    act(() => {
      FakeSocket.last.serverOpen()
      FakeSocket.last.serverSend({ type: 'welcome', code: 'ABCD', playerId: 'p1', token: 't' })
      FakeSocket.last.serverSend(room)
    })
    fireEvent.click(screen.getByText('Rules'))
    await screen.findByText('role distribution')
    fireEvent.click(screen.getByText(/Back/))
    expect(screen.queryByText('role distribution')).toBeNull()
    expect(screen.getByText('room ABCD')).toBeTruthy()
    expect(FakeSocket.all).toHaveLength(1)
  })

  it('shows an error when the catalog cannot load, and retries next time', async () => {
    const fetch = stubFetch(false)
    render(<App />)
    fireEvent.click(screen.getByText('Cards'))
    expect(await screen.findByText('Could not load the cards. Try again later.')).toBeTruthy()
    fireEvent.click(screen.getByText(/Back/))
    fireEvent.click(screen.getByText('Cards'))
    await screen.findByText('Could not load the cards. Try again later.')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
