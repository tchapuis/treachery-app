import { useSyncExternalStore } from 'react'
import type { AppError, Rarity, Role } from './types'

const en = {
  connecting: 'Connecting…',
  language: 'Change language',
  leave: 'Leave',
  back: 'Back',
  kicked: 'Your seat is open on another device.',
  nickname: 'nickname',
  nicknameRequired: 'Required to join or create a room.',
  roomCode: 'room code',
  join: 'join',
  noCode: 'No code?',
  createTitle: 'Create a room',
  createSubtitle: 'Room — New game',
  players: 'players',
  fewerPlayers: 'One player less',
  morePlayers: 'One player more',
  playerRange: 'from 4 to 8',
  rarities: 'rarities',
  create: 'create the room',
  host: 'host',
  you: 'you',
  notReady: 'not ready',
  disconnected: 'disconnected',
  freeSeat: 'Free seat',
  freeSeats: 'free seats: {n}',
  shareLink: 'Share the link',
  linkCopied: 'Link copied',
  imReady: "I'm ready",
  notReadyAnymore: "I'm not ready anymore",
  startDraw: 'start the draw',
  waitingReady: 'not everyone is ready',
  roomTitle: 'room {code}',
  see: 'See',
  identityLine: 'Identity — {role}',
  identityOf: 'identity: {name}',
  table: 'table',
  faceDown: 'face down',
  unveil: 'Unveil my identity',
  confirmUnveil: 'Unveil your identity to the whole table? This cannot be undone.',
  unveilNow: 'Unveil',
  cancel: 'Cancel',
  playerActions: 'actions for {name}',
  kick: 'Remove',
  confirmKick: 'Remove {name} from the room?',
  makeHost: 'Make host',
  confirmMakeHost: 'Make {name} the host? You lose the host controls.',
  yourIdentity: 'your identity',
  holdToReveal: 'Hold to reveal',
  holdHint: 'Your secret identity. Let go to hide it.',
  letGo: 'let go to hide',
  tapToClose: 'tap to close',
  cardLine: '{num}/{total} · {rarity} · ill. {artist}',
  newGame: 'New game',
  confirmNewGame: 'Start a new game?',
  rules: 'Rules',
  cards: 'Cards',
  loading: 'Loading…',
  catalogError: 'Could not load the cards. Try again later.',
  rulesSetupTitle: 'setup',
  rulesSetup: 'Everyone starts at 20 life with 7 cards in hand. Each player gets one identity, face down. The Leader turns theirs face up right away and takes the first turn.',
  distributionTitle: 'role distribution',
  rulesWinTitle: 'how to win',
  win_Leader: 'Be among the last players in the game, together with the Guardians.',
  win_Guardian: 'Protect the Leader. You win with them, and you lose once every Leader is out, even if you are still alive.',
  win_Assassin: 'Take out every Leader while at least one Assassin is still in the game.',
  win_Traitor: 'Be the last player in the game, other Traitors included.',
  rulesUnveilTitle: 'unveiling',
  rulesUnveil: 'You can turn your identity face up whenever you have priority, by paying its unveil cost. It does not use the stack. Until then, every other player is your opponent.',
  rulesDeath: 'A player who leaves the game reveals their identity.',
  rulesRarity: 'Uncommons are best for a first game. Rares and mythics are for experienced players. Specials are chaotic Traitors: agree on them as a group. Rarity says nothing about power.',
  fullRules: 'Full rules on mtgtreachery.net',
  credits: 'Identities and artwork from {site}; each illustration belongs to its artist. Magic: The Gathering © Wizards of the Coast. Unofficial project.',
  role_Leader: 'Leader',
  role_Traitor: 'Traitor',
  role_Assassin: 'Assassin',
  role_Guardian: 'Guardian',
  rarity_U: 'Uncommon',
  rarity_R: 'Rare',
  rarity_M: 'Mythic',
  rarity_S: 'Special',
  rarityHint_U: 'best for beginners',
  rarityHint_S: 'chaotic Traitors',
  error_invalidPlayerCount: 'The number of players must be between 4 and 8.',
  error_noRarity: 'Pick at least one rarity.',
  error_unknownRarity: 'Unknown rarity: {rarity}.',
  error_notEnoughIdentities: 'Not enough {role} identities with these rarities ({have} for {need}).',
  error_invalidNickname: 'Your nickname must be 1 to 20 characters long.',
  error_roomNotFound: 'Room not found.',
  error_gameStarted: 'The game has already started.',
  error_roomFull: 'The room is full.',
  error_nicknameTaken: 'This nickname is already taken in the room.',
  error_seatNotFound: 'Seat not found in this room.',
  error_seatExpired: 'Your seat in the room has expired. Join it again.',
  error_kickedByHost: 'The host removed you from the room.',
  error_roomNotFull: 'The room is not full.',
  error_notAllReady: 'Not everyone is ready.',
  error_unknown: 'Something went wrong ({code}).',
}

type Key = keyof typeof en

const fr: Record<Key, string> = {
  connecting: 'Connexion…',
  language: 'Changer de langue',
  leave: 'Quitter',
  back: 'Retour',
  kicked: 'Ta place est ouverte sur un autre appareil.',
  nickname: 'pseudo',
  nicknameRequired: 'Obligatoire pour rejoindre ou créer une room.',
  roomCode: 'code de la room',
  join: 'rejoindre',
  noCode: 'Pas de code ?',
  createTitle: 'Créer une room',
  createSubtitle: 'Room — Nouvelle partie',
  players: 'joueurs',
  fewerPlayers: 'Un joueur de moins',
  morePlayers: 'Un joueur de plus',
  playerRange: 'de 4 à 8',
  rarities: 'raretés',
  create: 'créer la room',
  host: 'hôte',
  you: 'toi',
  notReady: 'pas prêt',
  disconnected: 'déconnecté',
  freeSeat: 'Place libre',
  freeSeats: 'places libres : {n}',
  shareLink: 'Partager le lien',
  linkCopied: 'Lien copié',
  imReady: 'Je suis prêt',
  notReadyAnymore: 'Je ne suis plus prêt',
  startDraw: 'lancer le tirage',
  waitingReady: 'pas tous prêts',
  roomTitle: 'room {code}',
  see: 'Voir',
  identityLine: 'Identité — {role}',
  identityOf: 'identité : {name}',
  table: 'table',
  faceDown: 'face cachée',
  unveil: 'Dévoiler mon identité',
  confirmUnveil: "Dévoiler ton identité à toute la table ? C'est définitif.",
  unveilNow: 'Dévoiler',
  cancel: 'Annuler',
  playerActions: 'actions pour {name}',
  kick: 'Exclure',
  confirmKick: 'Exclure {name} de la room ?',
  makeHost: "Passer l'hôte",
  confirmMakeHost: "Passer l'hôte à {name} ? Tu perds les commandes d'hôte.",
  yourIdentity: 'ton identité',
  holdToReveal: 'Maintiens pour révéler',
  holdHint: 'Ton identité secrète. Relâche pour la cacher.',
  letGo: 'relâche pour cacher',
  tapToClose: 'touche pour fermer',
  cardLine: '{num}/{total} · {rarity} · ill. {artist}',
  newGame: 'Nouvelle partie',
  confirmNewGame: 'Relancer une nouvelle partie ?',
  rules: 'Règles',
  cards: 'Cartes',
  loading: 'Chargement…',
  catalogError: 'Impossible de charger les cartes. Réessaie plus tard.',
  rulesSetupTitle: 'mise en place',
  rulesSetup: 'Chacun commence à 20 points de vie avec 7 cartes en main. Chaque joueur reçoit une identité, face cachée. Le Leader retourne la sienne tout de suite et joue en premier.',
  distributionTitle: 'distribution des rôles',
  rulesWinTitle: 'comment gagner',
  win_Leader: 'Être parmi les derniers joueurs en jeu, avec les Gardiens.',
  win_Guardian: "Protéger le Leader. Tu gagnes avec lui, et tu perds dès que tous les Leaders sont éliminés, même si tu es encore en vie.",
  win_Assassin: "Éliminer tous les Leaders pendant qu'au moins un Assassin est encore en jeu.",
  win_Traitor: 'Être le dernier joueur en jeu, autres Traîtres compris.',
  rulesUnveilTitle: 'dévoilement',
  rulesUnveil: "Tu peux retourner ton identité dès que tu as la priorité, en payant son coût de dévoilement. Ça n'utilise pas la pile. Avant ça, tous les autres joueurs sont tes adversaires.",
  rulesDeath: 'Un joueur éliminé révèle son identité.',
  rulesRarity: "Les peu communes sont idéales pour une première partie. Les rares et mythiques sont pour les joueurs expérimentés. Les spéciales sont des Traîtres chaotiques : décidez-en ensemble. La rareté ne dit rien de la puissance.",
  fullRules: 'Règles complètes sur mtgtreachery.net',
  credits: 'Identités et illustrations : {site}, chaque illustration appartient à son artiste. Magic: The Gathering © Wizards of the Coast. Projet non officiel.',
  role_Leader: 'Leader',
  role_Traitor: 'Traître',
  role_Assassin: 'Assassin',
  role_Guardian: 'Gardien',
  rarity_U: 'Peu commune',
  rarity_R: 'Rare',
  rarity_M: 'Mythique',
  rarity_S: 'Spéciale',
  rarityHint_U: 'idéal pour débuter',
  rarityHint_S: 'Traîtres chaotiques',
  error_invalidPlayerCount: 'Le nombre de joueurs doit être entre 4 et 8.',
  error_noRarity: 'Choisis au moins une rareté.',
  error_unknownRarity: 'Rareté inconnue : {rarity}.',
  error_notEnoughIdentities: "Pas assez d'identités {role} avec ces raretés ({have} pour {need}).",
  error_invalidNickname: 'Le pseudo doit faire entre 1 et 20 caractères.',
  error_roomNotFound: 'Room introuvable.',
  error_gameStarted: 'La partie a déjà commencé.',
  error_roomFull: 'La room est pleine.',
  error_nicknameTaken: 'Ce pseudo est déjà pris dans la room.',
  error_seatNotFound: 'Place introuvable dans cette room.',
  error_seatExpired: 'Ta place dans la room a expiré. Rejoins-la à nouveau.',
  error_kickedByHost: "L'hôte t'a retiré de la room.",
  error_roomNotFull: "La room n'est pas pleine.",
  error_notAllReady: "Tout le monde n'est pas prêt.",
  error_unknown: 'Une erreur est survenue ({code}).',
}

const dicts = { en, fr }
export type Lang = keyof typeof dicts
export const LANGS = Object.keys(dicts) as Lang[]
const LANG_KEY = 'treachery:lang'

let lang: Lang = (() => {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved && saved in dicts) return saved as Lang
  } catch {}
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
})()
document.documentElement.lang = lang

const listeners = new Set<() => void>()

export function setLang(next: Lang) {
  lang = next
  document.documentElement.lang = next
  try {
    localStorage.setItem(LANG_KEY, next)
  } catch {}
  listeners.forEach((l) => l())
}

type Params = Record<string, string | number>

function translate(key: Key, params: Params = {}) {
  return dicts[lang][key].replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? `{${p}}`))
}

export function useI18n() {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => lang,
  )
  const t = translate
  return {
    lang: current,
    t,
    role: (r: Role) => t(`role_${r}`),
    rarity: (r: Rarity) => t(`rarity_${r}`),
    rarityHint: (r: Rarity) => (`rarityHint_${r}` in en ? t(`rarityHint_${r}` as Key) : ''),
    error: (e: AppError) => {
      const key = `error_${e.code}`
      if (!(key in en)) return t('error_unknown', { code: e.code })
      const params = { ...e.params }
      if (typeof params.role === 'string') params.role = t(`role_${params.role as Role}`)
      return t(key as Key, params)
    },
  }
}
