import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { FakeSocket } from './test/fakeSocket'
import type { RoomView } from './types'

const card = { id: 7, name: 'The Oracle', role: 'Guardian' as const, rarity: 'U' as const, artist: 'Someone' }
const leaderCard = { id: 62, name: 'The Void Tyrant', role: 'Leader' as const, rarity: 'M' as const, artist: 'Other' }

const playing: RoomView = {
  type: 'room',
  code: 'ABCD',
  phase: 'playing',
  hostId: 'p2',
  settings: { playerCount: 4, rarities: ['U', 'M'] },
  players: [
    { id: 'p1', name: 'Alice', ready: true, connected: true },
    { id: 'p2', name: 'Bob', ready: true, connected: true, card: leaderCard },
  ],
}

// the same room once Alice has unveiled: her card is public too
const aliceUnveiled: RoomView = {
  ...playing,
  players: [{ ...playing.players[0], card }, playing.players[1]],
}

beforeEach(() => {
  FakeSocket.all = []
  vi.stubGlobal('WebSocket', FakeSocket)
  localStorage.clear()
})

afterEach(() => vi.unstubAllGlobals())

function startGame() {
  render(<App />)
  act(() => {
    const sock = FakeSocket.last
    sock.serverOpen()
    sock.serverSend({ type: 'welcome', code: 'ABCD', playerId: 'p1', token: 't' })
    sock.serverSend(playing)
    sock.serverSend({ type: 'you', role: 'Guardian', card })
  })
}

describe('Game screen', () => {
  it('shows the Leader to everyone, with artist credit on the full card', () => {
    startGame()
    expect(screen.getByText('Bob')).toBeTruthy()
    expect(screen.getByText('The Void Tyrant')).toBeTruthy()
    expect(screen.queryByText('identity: Bob')).toBeNull()
    fireEvent.click(screen.getByText('See'))
    const full = screen.getByText('identity: Bob').closest('.reveal')!
    expect(full.className).toContain('shown')
    expect(screen.getByText('062/062 · m · ill. Other')).toBeTruthy()
  })

  it('keeps the other seats face down', () => {
    startGame()
    const alice = screen.getByText('Alice').closest('.identity') as HTMLElement
    expect(alice.className).toContain('face-down')
    expect(within(alice).getByText('face down')).toBeTruthy()
    expect(within(alice).queryByText('See')).toBeNull()
  })

  it('reveals the secret card only while held', () => {
    startGame()
    const secret = screen.getByText('Hold to reveal').parentElement!
    const reveal = screen.getByText('your identity').closest('.reveal')!
    expect(reveal.className).not.toContain('shown')

    fireEvent.pointerDown(secret)
    expect(reveal.className).toContain('shown')
    expect(screen.getByText('Guardian')).toBeTruthy()
    expect(screen.getByText('007/062 · u · ill. Someone')).toBeTruthy()

    fireEvent.pointerUp(secret)
    expect(reveal.className).not.toContain('shown')
  })

  it('hides the secret card again when the finger slides off', () => {
    startGame()
    const secret = screen.getByText('Hold to reveal').parentElement!
    const reveal = screen.getByText('your identity').closest('.reveal')!
    fireEvent.pointerDown(secret)
    fireEvent.pointerLeave(secret)
    expect(reveal.className).not.toContain('shown')
  })

  it('asks in the page before unveiling and sends nothing when the player backs out', () => {
    startGame()
    fireEvent.click(screen.getByText('Unveil my identity'))
    expect(screen.getByText(/cannot be undone/)).toBeTruthy()
    expect(FakeSocket.last.sent).toEqual([])

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText(/cannot be undone/)).toBeNull()
    expect(screen.getByText('Unveil my identity')).toBeTruthy()
    expect(FakeSocket.last.sent).toEqual([])
  })

  // a browser that suppresses dialogs answers confirm() with false and swallows the unveil
  it('unveils once confirmed, without a browser dialog', () => {
    startGame()
    const dialog = vi.spyOn(window, 'confirm')
    fireEvent.click(screen.getByText('Unveil my identity'))
    fireEvent.click(screen.getByText('Unveil'))
    expect(FakeSocket.last.sent).toEqual([{ type: 'unveil' }])
    expect(dialog).not.toHaveBeenCalled()
  })

  it('drops the hold-to-reveal block once my identity is public', () => {
    startGame()
    act(() => FakeSocket.last.serverSend(aliceUnveiled))

    expect(screen.queryByText('Hold to reveal')).toBeNull()
    expect(screen.queryByText('Unveil my identity')).toBeNull()
    const alice = screen.getByText('Alice').closest('.identity') as HTMLElement
    expect(alice.className).not.toContain('face-down')
    expect(within(alice).getByText('The Oracle')).toBeTruthy()
    expect(within(alice).getByText('Identity — Guardian')).toBeTruthy()
  })
})
