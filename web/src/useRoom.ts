import { useEffect, useRef, useState } from 'react'
import type { AppError, Card, ClientMsg, RoomView, ServerMsg } from './types'

interface Session {
  code: string
  playerId: string
  token: string
}

const SESSION_KEY = 'treachery:session'

function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // private mode: the player just can't resume after a reload
  }
}

export function codeFromUrl(): string {
  return location.pathname.match(/^\/r\/([A-Za-z]{4})$/)?.[1]?.toUpperCase() ?? ''
}

export function useRoom() {
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<RoomView | null>(null)
  const [me, setMe] = useState<Card | null>(null)
  const [playerId, setPlayerId] = useState(loadSession()?.playerId ?? '')
  const [error, setError] = useState<AppError | null>(null)
  const [kicked, setKicked] = useState(false)
  const ws = useRef<WebSocket | null>(null)
  const resuming = useRef(false)

  useEffect(() => {
    let stopped = false
    let retry: ReturnType<typeof setTimeout>

    const connect = () => {
      const sock = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
      ws.current = sock
      sock.onopen = () => {
        setConnected(true)
        const s = loadSession()
        const urlCode = codeFromUrl()
        if (s && (!urlCode || urlCode === s.code)) {
          resuming.current = true
          sock.send(JSON.stringify({ type: 'resume', code: s.code, token: s.token } satisfies ClientMsg))
        }
      }
      sock.onmessage = (e) => {
        if (sock !== ws.current) return
        const msg: ServerMsg = JSON.parse(e.data)
        switch (msg.type) {
          case 'welcome':
            resuming.current = false
            saveSession({ code: msg.code, playerId: msg.playerId, token: msg.token })
            setPlayerId(msg.playerId)
            setError(null)
            history.replaceState(null, '', `/r/${msg.code}`)
            break
          case 'room':
            setRoom(msg)
            if (msg.phase === 'lobby') setMe(null)
            break
          case 'you':
            setMe(msg.card)
            break
          case 'error':
            if (resuming.current) {
              // our seat is gone (server restarted or room expired): start fresh
              resuming.current = false
              saveSession(null)
              setPlayerId('')
              setRoom(null)
              setMe(null)
              setError({ code: 'seatExpired' })
              break
            }
            setError(msg.error)
            break
        }
      }
      sock.onclose = (e) => {
        if (sock !== ws.current) return // a newer socket already replaced this one
        setConnected(false)
        if (e.code === 1008) {
          setKicked(true) // same seat opened on another device
          return
        }
        if (!stopped) retry = setTimeout(connect, 1000)
      }
    }
    connect()

    // phones suspend sockets in background: reconnect as soon as the tab is visible again
    const onVisible = () => {
      if (document.visibilityState === 'visible' && ws.current?.readyState === WebSocket.CLOSED && !stopped) {
        clearTimeout(retry)
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearTimeout(retry)
      document.removeEventListener('visibilitychange', onVisible)
      ws.current?.close()
    }
  }, [])

  const send = (msg: ClientMsg) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return
    setError(null)
    ws.current.send(JSON.stringify(msg))
  }

  const leave = () => {
    saveSession(null)
    const sock = ws.current
    const home = () => (location.href = '/')
    if (sock?.readyState !== WebSocket.OPEN) return home()
    // close before navigating so the server gets `leave` and frees the nickname
    ws.current = null
    sock.onclose = home
    sock.send(JSON.stringify({ type: 'leave' } satisfies ClientMsg))
    sock.close()
    setTimeout(home, 1000)
  }

  return { connected, room, me, playerId, error, kicked, send, leave }
}
