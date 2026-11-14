import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { FakeSocket } from './test/fakeSocket'
import type { RoomView } from './types'

const lobby: RoomView = {
  type: 'room',
  code: 'ABCD',
  phase: 'lobby',
  hostId: 'p1',
  settings: { playerCount: 4, rarities: ['U'] },
  players: [
    { id: 'p1', name: 'Alice', ready: false, connected: true },
    { id: 'p2', name: 'Bob', ready: false, connected: true },
  ],
}

beforeEach(() => {
  FakeSocket.all = []
  vi.stubGlobal('WebSocket', FakeSocket)
  localStorage.clear()
})

afterEach(() => vi.unstubAllGlobals())

function enter(me: string, room: RoomView = lobby) {
  render(<App />)
  act(() => {
    FakeSocket.last.serverOpen()
    FakeSocket.last.serverSend({ type: 'welcome', code: 'ABCD', playerId: me, token: 't' })
    FakeSocket.last.serverSend(room)
  })
}

describe('host controls', () => {
  it('kicks a player only after a confirmation', () => {
    enter('p1')
    fireEvent.click(screen.getByRole('button', { name: 'actions for Bob' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByText('Remove Bob from the room?')).toBeTruthy()
    expect(FakeSocket.last.sent.some((m) => m.type === 'kick')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(FakeSocket.last.sent.at(-1)).toEqual({ type: 'kick', playerId: 'p2' })
  })

  it('sends nothing when the host cancels', () => {
    enter('p1')
    fireEvent.click(screen.getByRole('button', { name: 'actions for Bob' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make host' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(FakeSocket.last.sent.some((m) => m.type === 'transferHost')).toBe(false)
  })

  it('gives no controls to other players, nor over yourself', () => {
    enter('p2')
    expect(screen.queryByRole('button', { name: /^actions for/ })).toBeNull()
  })

  it('only offers the host transfer during a game', () => {
    enter('p1', { ...lobby, phase: 'playing' })
    fireEvent.click(screen.getByRole('button', { name: 'actions for Bob' }))
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Make host' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make host' }))
    expect(FakeSocket.last.sent.at(-1)).toEqual({ type: 'transferHost', playerId: 'p2' })
  })

  it('sends a kicked player home with a message', () => {
    enter('p2')
    act(() => FakeSocket.last.serverSend({ type: 'kicked' }))
    expect(screen.getByRole('alert').textContent).toBe('The host removed you from the room.')
    expect(screen.getByRole('textbox', { name: 'nickname' })).toBeTruthy()
    expect(localStorage.getItem('treachery:session')).toBeNull()
  })
})
