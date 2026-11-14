import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { codeFromUrl, useRoom } from './useRoom'
import { LANGS, setLang, useI18n } from './i18n'
import { useCatalog } from './catalog'
import { roleOrder, type Card, type PlayerView, type Rarity, type Role, type RoomView } from './types'

const RARITIES: Rarity[] = ['U', 'R', 'M', 'S']
const CARD_COUNT = 62
const NICK_KEY = 'treachery:nickname'

function storedNick() {
  try {
    return localStorage.getItem(NICK_KEY) ?? ''
  } catch {
    return ''
  }
}

type Send = ReturnType<typeof useRoom>['send']
type GuidePage = 'rules' | 'cards'
type OpenGuide = (page: GuidePage) => void

export default function App() {
  const r = useRoom()
  const { t, error } = useI18n()
  const [guide, setGuide] = useState<GuidePage | null>(null)

  let screen: ReactNode
  if (r.kicked) {
    screen = (
      <>
        <Bar left={<Brand />} />
        <p className="notice">{t('kicked')}</p>
      </>
    )
  } else if (!r.room || !r.playerId) {
    screen = <Home connected={r.connected} send={r.send} openGuide={setGuide} />
  } else if (r.room.phase === 'lobby') {
    screen = <Lobby room={r.room} playerId={r.playerId} send={r.send} leave={r.leave} openGuide={setGuide} />
  } else {
    screen = <Game room={r.room} playerId={r.playerId} me={r.me} send={r.send} leave={r.leave} openGuide={setGuide} />
  }

  return (
    <main className="screen">
      {/* always mounted so screen readers announce what appears in it */}
      <div className="toasts" role="status">
        {!r.connected && !r.kicked && <p className="toast">{t('connecting')}</p>}
        {r.error && (
          <p className="toast error" role="alert">
            {error(r.error)}
          </p>
        )}
      </div>
      {screen}
      {guide && <Guide page={guide} setPage={setGuide} close={() => setGuide(null)} />}
    </main>
  )
}

function Bar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <header className="bar">
      {left}
      {right}
    </header>
  )
}

function Brand() {
  return <h1 className="brand">Treachery</h1>
}

function Diamond({ className = '', color }: { className?: string; color?: string }) {
  return <span className={`diamond ${className}`} style={color ? { background: color } : undefined} />
}

function BackArrow() {
  return <span aria-hidden>← </span>
}

function GuideLinks({ open }: { open: OpenGuide }) {
  const { t } = useI18n()
  return (
    <p className="guide-links">
      <button className="link underline" onClick={() => open('rules')}>
        {t('rules')}
      </button>
      <span aria-hidden>·</span>
      <button className="link underline" onClick={() => open('cards')}>
        {t('cards')}
      </button>
    </p>
  )
}

function Home({ connected, send, openGuide }: { connected: boolean; send: Send; openGuide: OpenGuide }) {
  const { t, lang } = useI18n()
  const [nickname, setNickname] = useState(storedNick)
  const [code, setCode] = useState(codeFromUrl)
  const [codeFocus, setCodeFocus] = useState(false)
  const [creating, setCreating] = useState(false)
  const nick = nickname.trim()
  const nickHintId = useId()
  const [creditsBefore, creditsAfter] = t('credits').split('{site}')

  const remember = () => {
    try {
      localStorage.setItem(NICK_KEY, nick)
    } catch {}
  }

  if (creating) {
    return (
      <Create
        connected={connected}
        back={() => setCreating(false)}
        create={(playerCount, rarities) => {
          remember()
          send({ type: 'create', nickname: nick, playerCount, rarities })
        }}
      />
    )
  }

  const nextLang = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]
  return (
    <>
      <Bar
        left={<Brand />}
        right={
          <button className="link sc" onClick={() => setLang(nextLang)} aria-label={`${lang} · ${t('language')}`}>
            {lang}
          </button>
        }
      />
      <label className="nick">
        <span className="caption">{t('nickname')}</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          autoComplete="nickname"
          required
          aria-describedby={nick ? undefined : nickHintId}
        />
      </label>
      {!nick && (
        <p className="nick-hint muted italic small" id={nickHintId}>
          {t('nicknameRequired')}
        </p>
      )}

      <form
        className="push"
        onSubmit={(e) => {
          e.preventDefault()
          remember()
          send({ type: 'join', code, nickname: nick })
        }}
      >
        <label className="code-boxes">
          <span className="caption">{t('roomCode')}</span>
          <span className="boxes">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} aria-hidden className={`box ${codeFocus && i === Math.min(code.length, 3) ? 'active' : ''}`}>
                {code[i] ?? (codeFocus && i === code.length ? <span className="caret" /> : '')}
              </span>
            ))}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
              onFocus={() => setCodeFocus(true)}
              onBlur={() => setCodeFocus(false)}
              maxLength={4}
              autoCapitalize="characters"
              autoComplete="off"
              enterKeyHint="go"
            />
          </span>
        </label>
        <button className="cta" disabled={!connected || !nick || code.length !== 4}>
          {t('join')}
        </button>
      </form>

      <div className="split">
        <span className="muted italic">{t('noCode')}</span>
        <button className="link strong" disabled={!nick} onClick={() => setCreating(true)}>
          {t('createTitle')}
        </button>
      </div>
      <GuideLinks open={openGuide} />
      <p className="credits">
        {creditsBefore}
        <a href={`https://mtgtreachery.net/${lang}/`} target="_blank" rel="noreferrer">
          mtgtreachery.net
        </a>
        {creditsAfter}
      </p>
    </>
  )
}

const RARITY_COLOR: Record<Rarity, string> = { U: '#b8c0c6', R: '#d4b05a', M: '#e0703a', S: '#a98bd0' }

function Create({
  connected,
  back,
  create,
}: {
  connected: boolean
  back: () => void
  create: (playerCount: number, rarities: Rarity[]) => void
}) {
  const { t, rarity, rarityHint } = useI18n()
  const [playerCount, setPlayerCount] = useState(5)
  const [rarities, setRarities] = useState<Rarity[]>(['U', 'R', 'M'])
  const playersId = useId()
  const raritiesId = useId()
  const toggle = (id: Rarity) => setRarities((rs) => (rs.includes(id) ? rs.filter((x) => x !== id) : [...rs, id]))

  return (
    <>
      <Bar left={<button className="link" onClick={back}><BackArrow />{t('back')}</button>} />
      <h1 className="title">{t('createTitle')}</h1>
      <p className="typeline">{t('createSubtitle')}</p>

      <span className="caption gap" id={playersId}>{t('players')}</span>
      <div className="stepper" role="group" aria-labelledby={playersId}>
        <button onClick={() => setPlayerCount((n) => n - 1)} disabled={playerCount <= 4} aria-label={t('fewerPlayers')}>
          −
        </button>
        <output>{playerCount}</output>
        <button onClick={() => setPlayerCount((n) => n + 1)} disabled={playerCount >= 8} aria-label={t('morePlayers')}>
          +
        </button>
      </div>
      <span className="muted italic center small">{t('playerRange')}</span>

      <span className="caption gap" id={raritiesId}>{t('rarities')}</span>
      <div className="rows" role="group" aria-labelledby={raritiesId}>
        {RARITIES.map((id) => {
          const on = rarities.includes(id)
          return (
            <label key={id} className={`row ${on ? 'on' : ''}`}>
              <Diamond color={RARITY_COLOR[id]} />
              <span className="row-text">
                <span className="row-name">{rarity(id)}</span>
                {rarityHint(id) && <span className="muted italic small">{rarityHint(id)}</span>}
              </span>
              <input type="checkbox" checked={on} onChange={() => toggle(id)} />
              <span className="check" />
            </label>
          )
        })}
      </div>

      <button className="cta gold push" disabled={!connected || rarities.length === 0} onClick={() => create(playerCount, rarities)}>
        {t('create')}
      </button>
    </>
  )
}

function Lobby({
  room,
  playerId,
  send,
  leave,
  openGuide,
}: {
  room: RoomView
  playerId: string
  send: Send
  leave: () => void
  openGuide: OpenGuide
}) {
  const { t, rarity } = useI18n()
  const me = room.players.find((p) => p.id === playerId)
  const isHost = room.hostId === playerId
  const free = room.settings.playerCount - room.players.length
  const allReady = free === 0 && room.players.every((p) => p.ready)
  const url = `${location.origin}/r/${room.code}`
  const [copied, setCopied] = useState(false)

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Treachery', url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    }
  }

  return (
    <>
      <Bar
        left={<button className="link" onClick={leave}><BackArrow />{t('leave')}</button>}
        right={<span className="sc">{room.players.length}/{room.settings.playerCount}</span>}
      />
      <h1 className="sr-only">{t('roomTitle', { code: room.code })}</h1>
      <span className="caption gap">{t('roomCode')}</span>
      <span className="big-code">{room.code}</span>
      <button className="outline" onClick={share}>
        {copied ? t('linkCopied') : t('shareLink')}
      </button>

      <span className="caption gap">{t('players')}</span>
      <ul className="seats">
        {room.players.map((p) => {
          const notes = [
            p.id === room.hostId && t('host'),
            p.id === playerId && t('you'),
            !p.ready && p.connected && t('notReady'),
          ].filter(Boolean)
          return (
            <li key={p.id} className={p.connected ? '' : 'away'}>
              <Diamond className={p.ready ? 'gold' : 'hollow'} />
              <span className="seat-name">{p.name}</span>
              {!p.connected ? (
                <span className="note danger">{t('disconnected')}</span>
              ) : (
                notes.length > 0 && <span className="note">{notes.join(', ')}</span>
              )}
            </li>
          )
        })}
        {Array.from({ length: free }, (_, i) => (
          <li key={`free${i}`} className="free">
            {t('freeSeat')}
          </li>
        ))}
      </ul>
      <p className="legend">
        {room.settings.rarities.map((id) => (
          <span key={id}>
            <Diamond color={RARITY_COLOR[id]} />
            {rarity(id)}
          </span>
        ))}
      </p>
      <GuideLinks open={openGuide} />

      <div className="actions push">
        <button className={me?.ready ? 'outline' : 'cta gold'} onClick={() => send({ type: 'ready', value: !me?.ready })}>
          {me?.ready ? t('notReadyAnymore') : t('imReady')}
        </button>
        {isHost && (
          <button className={`cta ${allReady ? 'gold' : ''}`} disabled={!allReady} onClick={() => send({ type: 'start' })}>
            {t('startDraw')}
            {!allReady && (
              <span className="cta-note">· {free > 0 ? t('freeSeats', { n: free }) : t('waitingReady')}</span>
            )}
          </button>
        )}
      </div>
    </>
  )
}

function Reveal({
  card,
  heading,
  hint,
  shown,
  onClose,
}: {
  card: Card
  heading: string
  hint: string
  shown: boolean
  onClose?: () => void
}) {
  const { t, role, rarity } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!shown || !onClose) return
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => opener?.focus()
  }, [shown])
  const dialog = onClose && {
    role: 'dialog',
    'aria-modal': true,
    'aria-label': heading,
    onClick: onClose,
    onKeyDown: (e: React.KeyboardEvent) => e.key === 'Escape' && onClose(),
  }
  return (
    // always rendered so the image is loaded before the first reveal
    <div className={`reveal ${shown ? 'shown' : ''} ${onClose ? 'closable' : ''}`} aria-hidden={!shown} {...dialog}>
      <Bar left={<span className="caption">{heading}</span>} />
      <p className={`role role-${card.role}`}>{role(card.role)}</p>
      <p className="typeline">
        {t('identityLine', { role: role(card.role) })} · {card.name}
      </p>
      <img src={`/cards/${card.id}.jpg`} alt="" draggable={false} />
      <p className="collector">
        <span title={rarity(card.rarity)}>
          {t('cardLine', {
            num: String(card.id).padStart(3, '0'),
            total: String(CARD_COUNT).padStart(3, '0'),
            rarity: card.rarity.toLowerCase(),
            artist: card.artist,
          })}
        </span>
        {onClose ? (
          <button ref={closeRef} className="hint">
            {hint}
          </button>
        ) : (
          <span>{hint}</span>
        )}
      </p>
    </div>
  )
}

function Game({
  room,
  playerId,
  me,
  send,
  leave,
  openGuide,
}: {
  room: RoomView
  playerId: string
  me: Card | null
  send: Send
  leave: () => void
  openGuide: OpenGuide
}) {
  const { t, role } = useI18n()
  const [shown, setShown] = useState(false)
  const [open, setOpen] = useState<PlayerView | null>(null)
  const [asking, setAsking] = useState(false)
  const hide = () => setShown(false)
  // my own card reaches the room view only once I unveil: until then the server keeps it to the "you" message
  const unveiled = room.players.some((p) => p.id === playerId && p.card)

  return (
    <>
      <Bar
        left={<h1 className="sc">{t('roomTitle', { code: room.code })}</h1>}
        right={<button className="link" onClick={leave}>{t('leave')}</button>}
      />

      <h2 className="caption gap">{t('table')}</h2>
      <ul className="identities">
        {room.players.map((p) => (
          <li key={p.id} className={`identity ${p.card ? '' : 'face-down'}`}>
            {p.card ? <img src={`/cards/${p.card.id}.jpg`} alt="" /> : <Diamond className="hollow" />}
            <div>
              <div className="identity-top">
                <span className="identity-name">{p.name}</span>
                {p.card ? (
                  <button className="link underline" onClick={() => setOpen(p)}>
                    {t('see')}
                  </button>
                ) : (
                  p.id === playerId && <span className="note">{t('you')}</span>
                )}
              </div>
              {p.card ? (
                <>
                  <span className={`italic role-${p.card.role}`}>{t('identityLine', { role: role(p.card.role) })}</span>
                  <span className="muted small">{p.card.name}</span>
                </>
              ) : (
                <span className="muted italic small">{t('faceDown')}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {open?.card && (
        <Reveal
          card={open.card}
          heading={t('identityOf', { name: open.name })}
          hint={t('tapToClose')}
          shown
          onClose={() => setOpen(null)}
        />
      )}

      {me && !unveiled && (
        <>
          <button
            type="button"
            className="secret"
            aria-pressed={shown}
            onPointerDown={() => setShown(true)}
            onPointerUp={hide}
            onPointerLeave={hide}
            onPointerCancel={hide}
            // detail 0 = Enter/Space: keyboard users toggle instead of holding
            onClick={(e) => e.detail === 0 && setShown((v) => !v)}
            onKeyDown={(e) => e.key === 'Escape' && hide()}
            onBlur={hide}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Diamond className="hollow huge" />
            <span className="hold">{t('holdToReveal')}</span>
            <span className="muted italic">{t('holdHint')}</span>
          </button>
          <Reveal card={me} heading={t('yourIdentity')} hint={t('letGo')} shown={shown} />
          <p className="sr-only" role="status">
            {shown ? `${role(me.role)} · ${me.name}` : ''}
          </p>
        </>
      )}

      {me &&
        !unveiled &&
        (asking ? (
          <UnveilConfirm cancel={() => setAsking(false)} confirm={() => send({ type: 'unveil' })} />
        ) : (
          <button className="outline unveil" onClick={() => setAsking(true)}>
            {t('unveil')}
          </button>
        ))}
      <GuideLinks open={openGuide} />
      {room.hostId === playerId && (
        <button className="outline" onClick={() => confirm(t('confirmNewGame')) && send({ type: 'reset' })}>
          {t('newGame')}
        </button>
      )}
    </>
  )
}

// Asked in the page rather than through confirm(): a browser that suppresses dialogs
// (embedded view, "block further dialogs") answers no without showing anything, and the
// unveil would be swallowed in silence.
function UnveilConfirm({ cancel, confirm }: { cancel: () => void; confirm: () => void }) {
  const { t } = useI18n()
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])
  return (
    <div className="confirm" onKeyDown={(e) => e.key === 'Escape' && cancel()}>
      <p className="italic">{t('confirmUnveil')}</p>
      <div className="confirm-actions">
        <button ref={cancelRef} className="link underline" onClick={cancel}>
          {t('cancel')}
        </button>
        <button className="cta gold" onClick={confirm}>
          {t('unveilNow')}
        </button>
      </div>
    </div>
  )
}

function Guide({ page, setPage, close }: { page: GuidePage; setPage: OpenGuide; close: () => void }) {
  const { t } = useI18n()
  const { catalog, failed } = useCatalog()
  const backRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    backRef.current?.focus()
    return () => opener?.focus()
  }, [])
  return (
    <div className="guide" role="dialog" aria-modal aria-label={t(page)} onKeyDown={(e) => e.key === 'Escape' && close()}>
      <Bar
        left={
          <button ref={backRef} className="link" onClick={close}>
            <BackArrow />
            {t('back')}
          </button>
        }
        right={
          <span className="tabs">
            {(['rules', 'cards'] as const).map((p) => (
              <button key={p} className={`link sc ${p === page ? 'on' : ''}`} onClick={() => setPage(p)} aria-pressed={p === page}>
                {t(p)}
              </button>
            ))}
          </span>
        }
      />
      {failed ? (
        <p className="notice">{t('catalogError')}</p>
      ) : !catalog ? (
        <p className="notice">{t('loading')}</p>
      ) : page === 'rules' ? (
        <Rules distribution={catalog.distribution} />
      ) : (
        <Gallery cards={catalog.cards} />
      )}
    </div>
  )
}

const WIN_ORDER: Role[] = ['Leader', 'Guardian', 'Assassin', 'Traitor']

function Rules({ distribution }: { distribution: Record<string, number[]> }) {
  const { t, role } = useI18n()
  return (
    <article className="rules">
      <h2 className="caption gap">{t('rulesSetupTitle')}</h2>
      <p>{t('rulesSetup')}</p>

      <h2 className="caption gap">{t('distributionTitle')}</h2>
      <table className="dist">
        <thead>
          <tr>
            <th>{t('players')}</th>
            {roleOrder.map((r) => (
              <th key={r} className={`role-${r}`}>
                {role(r)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(distribution).map(([n, counts]) => (
            <tr key={n}>
              <th>{n}</th>
              {counts.map((c, i) => (
                <td key={roleOrder[i]} className={c ? '' : 'zero'}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="caption gap">{t('rulesWinTitle')}</h2>
      <dl className="wins">
        {WIN_ORDER.map((r) => (
          <div key={r}>
            <dt className={`role-${r}`}>{role(r)}</dt>
            <dd>{t(`win_${r}`)}</dd>
          </div>
        ))}
      </dl>

      <h2 className="caption gap">{t('rulesUnveilTitle')}</h2>
      <p>{t('rulesUnveil')}</p>
      <p>{t('rulesDeath')}</p>

      <h2 className="caption gap">{t('rarities')}</h2>
      <p>{t('rulesRarity')}</p>

      <p className="full-rules">
        <a href="https://mtgtreachery.net/rules/cr/" target="_blank" rel="noreferrer">
          {t('fullRules')}
        </a>
      </p>
    </article>
  )
}

function Gallery({ cards }: { cards: Card[] }) {
  const { t, role, rarity } = useI18n()
  const [open, setOpen] = useState<Card | null>(null)
  return (
    <div className="gallery">
      {WIN_ORDER.map((r) => (
        <section key={r} aria-label={role(r)}>
          <h2 className={`gallery-role role-${r}`}>{role(r)}</h2>
          {RARITIES.map((rar) => {
            const group = cards.filter((c) => c.role === r && c.rarity === rar)
            if (group.length === 0) return null
            return (
              <section key={rar} aria-label={`${role(r)} ${rarity(rar)}`}>
                <h3 className="caption gallery-rarity">
                  <Diamond color={RARITY_COLOR[rar]} />
                  {rarity(rar)} · {group.length}
                </h3>
                <div className="thumbs">
                  {group.map((c) => (
                    <button key={c.id} onClick={() => setOpen(c)}>
                      <img src={`/cards/${c.id}.jpg`} alt={c.name} loading="lazy" />
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </section>
      ))}
      {open && <Reveal card={open} heading={open.name} hint={t('tapToClose')} shown onClose={() => setOpen(null)} />}
    </div>
  )
}
