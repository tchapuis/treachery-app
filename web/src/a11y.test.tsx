import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { clearCatalogCache } from './catalog'
import { FakeSocket } from './test/fakeSocket'
import type { Card, RoomView } from './types'

const mine: Card = { id: 39, name: 'The Madwoman', role: 'Assassin', rarity: 'R', artist: 'X' }
const leaderCard: Card = { id: 62, name: 'The Void Tyrant', role: 'Leader', rarity: 'M', artist: 'Y' }
const room: RoomView = {
  type: 'room',
  code: 'ABCD',
  phase: 'playing',
  hostId: 'p2',
  settings: { playerCount: 4, rarities: ['R', 'M'] },
  players: [
    { id: 'p1', name: 'Alice', ready: true, connected: true },
    { id: 'p2', name: 'Bob', ready: true, connected: true, card: leaderCard },
  ],
}

beforeEach(() => {
  clearCatalogCache()
  FakeSocket.all = []
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ cards: [mine], distribution: {} }))))
  localStorage.clear()
})

afterEach(() => vi.unstubAllGlobals())

function startGame() {
  render(<App />)
  act(() => {
    FakeSocket.last.serverOpen()
    FakeSocket.last.serverSend({ type: 'welcome', code: 'ABCD', playerId: 'p1', token: 't' })
    FakeSocket.last.serverSend(room)
    FakeSocket.last.serverSend({ type: 'you', role: 'Assassin', card: mine })
  })
}

const isShown = (heading: string) => screen.getByText(heading).closest('.reveal')!.className.includes('shown')

describe('accessibility', () => {
  it('names the room code field without the letters drawn in the boxes', () => {
    history.replaceState(null, '', '/r/KXQR')
    render(<App />)
    expect(screen.getByRole('textbox', { name: 'room code' })).toBeTruthy()
    history.replaceState(null, '', '/')
  })

  it('lets keyboard users toggle the secret card and announces it', () => {
    startGame()
    const secret = screen.getByRole('button', { name: /Hold to reveal/ })
    fireEvent.click(secret, { detail: 0 })
    expect(isShown('your identity')).toBe(true)
    expect(secret.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Assassin · The Madwoman')).toBeTruthy()

    fireEvent.keyDown(secret, { key: 'Escape' })
    expect(isShown('your identity')).toBe(false)
    expect(screen.queryByText('Assassin · The Madwoman')).toBeNull()
  })

  it('does not toggle on a pointer click, which already holds and releases', () => {
    startGame()
    const secret = screen.getByRole('button', { name: /Hold to reveal/ })
    fireEvent.pointerDown(secret)
    fireEvent.pointerUp(secret)
    fireEvent.click(secret, { detail: 1 })
    expect(isShown('your identity')).toBe(false)
  })

  it('moves focus into a face-up identity, closes it with Escape and gives focus back', () => {
    startGame()
    const see = screen.getByRole('button', { name: 'See' })
    see.focus()
    fireEvent.click(see)
    const close = screen.getByRole('button', { name: 'tap to close' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Escape' })
    expect(screen.queryByText('identity: Bob')).toBeNull()
    expect(document.activeElement).toBe(see)
  })

  it('lets keyboard users cancel an unveil with Escape', () => {
    startGame()
    fireEvent.click(screen.getByRole('button', { name: 'Unveil my identity' }))
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(cancel, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Unveil my identity' })).toBeTruthy()
    expect(FakeSocket.last.sent).toEqual([])
  })

  it('closes the guide with Escape and gives focus back to the link', async () => {
    render(<App />)
    const link = screen.getByRole('button', { name: 'Rules' })
    link.focus()
    fireEvent.click(link)
    const dialog = screen.getByRole('dialog', { name: 'Rules' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Back/ }))
    await screen.findByText('setup')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(link)
  })
})

describe('nickname', () => {
  it('says the nickname is required until one is typed', () => {
    render(<App />)
    act(() => FakeSocket.last.serverOpen())
    const input = screen.getByRole('textbox', { name: 'nickname' })
    expect(input).toHaveProperty('required', true)
    const hint = document.getElementById(input.getAttribute('aria-describedby')!)
    expect(hint?.textContent).toBe('Required to join or create a room.')
    fireEvent.change(input, { target: { value: 'Alice' } })
    expect(input.getAttribute('aria-describedby')).toBeNull()
    expect(screen.queryByText('Required to join or create a room.')).toBeNull()
  })
})
