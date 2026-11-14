import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeSocket } from './test/fakeSocket'
import { useRoom } from './useRoom'
import type { RoomView } from './types'

const SESSION_KEY = 'treachery:session'
const session = { code: 'ABCD', playerId: 'p1', token: 'secret' }

const lobby: RoomView = {
  type: 'room',
  code: 'ABCD',
  phase: 'lobby',
  hostId: 'p1',
  settings: { playerCount: 4, rarities: ['U'] },
  players: [{ id: 'p1', name: 'Alice', ready: false, connected: true }],
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeSocket.all = []
  vi.stubGlobal('WebSocket', FakeSocket)
  localStorage.clear()
  history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function setVisible() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useRoom', () => {
  it('resumes the stored seat when the socket opens', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    renderHook(() => useRoom())
    act(() => FakeSocket.last.serverOpen())
    expect(FakeSocket.last.sent).toEqual([{ type: 'resume', code: 'ABCD', token: 'secret' }])
  })

  it('does not resume a seat from another room than the URL one', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    history.replaceState(null, '', '/r/WXYZ')
    renderHook(() => useRoom())
    act(() => FakeSocket.last.serverOpen())
    expect(FakeSocket.last.sent).toEqual([])
  })

  it('stores the session and the room URL on welcome', () => {
    const { result } = renderHook(() => useRoom())
    act(() => {
      FakeSocket.last.serverOpen()
      FakeSocket.last.serverSend({ type: 'welcome', ...session })
      FakeSocket.last.serverSend(lobby)
    })
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!)).toEqual(session)
    expect(location.pathname).toBe('/r/ABCD')
    expect(result.current.playerId).toBe('p1')
    expect(result.current.room?.code).toBe('ABCD')
  })

  it('drops an expired seat when resume fails', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    const { result } = renderHook(() => useRoom())
    act(() => {
      FakeSocket.last.serverOpen()
      FakeSocket.last.serverSend({ type: 'error', error: { code: 'seatNotFound' } })
    })
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(result.current.playerId).toBe('')
    expect(result.current.error).toEqual({ code: 'seatExpired' })
  })

  it('shows server errors outside of resume', () => {
    const { result } = renderHook(() => useRoom())
    act(() => {
      FakeSocket.last.serverOpen()
      FakeSocket.last.serverSend({ type: 'error', error: { code: 'roomFull' } })
    })
    expect(result.current.error).toEqual({ code: 'roomFull' })
  })

  it('reconnects after an unexpected close', () => {
    renderHook(() => useRoom())
    act(() => FakeSocket.last.serverOpen())
    act(() => FakeSocket.last.serverClose(1006))
    expect(FakeSocket.all).toHaveLength(1)
    act(() => vi.advanceTimersByTime(1000))
    expect(FakeSocket.all).toHaveLength(2)
  })

  it('stops and flags kicked when the seat is taken elsewhere (1008)', () => {
    const { result } = renderHook(() => useRoom())
    act(() => FakeSocket.last.serverOpen())
    act(() => FakeSocket.last.serverClose(1008))
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.kicked).toBe(true)
    expect(FakeSocket.all).toHaveLength(1)
  })

  // Regression: a late onclose from a replaced socket used to reconnect a
  // second time, and the server then kicked the player from their own seat.
  it('ignores events from a socket replaced on visibility change', () => {
    const { result } = renderHook(() => useRoom())
    const first = FakeSocket.last
    act(() => first.serverOpen())

    first.readyState = FakeSocket.CLOSED // phone suspended: closed, onclose not fired yet
    act(() => setVisible())
    const second = FakeSocket.last
    expect(second).not.toBe(first)
    act(() => second.serverOpen())

    act(() => {
      first.onclose?.({ code: 1006 })
      first.onmessage?.({ data: JSON.stringify(lobby) })
      vi.advanceTimersByTime(5000)
    })
    expect(FakeSocket.all).toHaveLength(2)
    expect(result.current.connected).toBe(true)
    expect(result.current.kicked).toBe(false)
    expect(result.current.room).toBeNull()
  })

  it('does not throw when sending while the socket is not open', () => {
    const { result } = renderHook(() => useRoom())
    expect(() => result.current.send({ type: 'start' })).not.toThrow()
    expect(FakeSocket.last.sent).toEqual([])
  })
  it('tells the server before leaving, so the nickname is free again', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    const { result } = renderHook(() => useRoom())
    const sock = FakeSocket.last
    act(() => sock.serverOpen())
    act(() => result.current.leave())
    expect(sock.sent.at(-1)).toEqual({ type: 'leave' })
    expect(sock.readyState).toBe(FakeSocket.CLOSED)
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })
})
