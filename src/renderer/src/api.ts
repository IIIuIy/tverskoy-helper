import type {
  AccountState,
  AiEvent,
  AppInfo,
  ChangesResponse,
  HistoryItem,
  NickVerdict,
  ProjectInfo,
  RuleHit,
  SearchResponse,
  ServerInfo,
  Settings,
  WikiEntry,
  WikiListItem,
  WikiSection
} from '../../shared/types'

export interface TverskoyBridge {
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
  send(channel: string, payload?: unknown): void
  on(event: string, cb: (payload: unknown) => void): () => void
}

declare global {
  interface Window {
    tverskoy: TverskoyBridge
  }
}

// Типизированные обёртки над мостом
export const api = {
  appInfo: () => window.tverskoy.invoke<AppInfo>('app:info'),
  projectsList: () =>
    window.tverskoy.invoke<Array<{ slug: string; name: string; tagline: string; initials: string; accent: string }>>('projects:list'),
  setProject: (slug: string) => window.tverskoy.invoke<Settings>('project:set', slug),
  setServer: (server: string | null) => window.tverskoy.invoke<Settings>('project:setServer', server),
  accountGet: () => window.tverskoy.invoke<AccountState>('account:get'),
  accountSignIn: () => window.tverskoy.invoke<AccountState>('account:signIn'),
  accountSignOut: () => window.tverskoy.invoke<AccountState>('account:signOut'),
  search: (q: string, opts?: { server?: string | null; limit?: number }) =>
    window.tverskoy.invoke<SearchResponse>('search', q, opts),
  lawsSearch: (q: string, opts?: { limit?: number }) => window.tverskoy.invoke<SearchResponse>('laws:search', q, opts),
  changesGet: () => window.tverskoy.invoke<ChangesResponse & { seenAt?: number | null }>('rules:changes'),
  changesSeen: () => window.tverskoy.invoke<boolean>('rules:changesSeen'),
  aiAnalyze: (q: string, opts?: { mode?: 'nick' }) => window.tverskoy.invoke<AiEvent | null>('ai:analyze', q, opts),
  aiCancel: (id: string) => window.tverskoy.invoke<boolean>('ai:cancel', id),
  aiFeedback: (id: string, verdict: 'up' | 'down' | null) => window.tverskoy.invoke<boolean>('ai:feedback', id, verdict),
  aiHistory: () => window.tverskoy.invoke<HistoryItem[]>('ai:history'),
  aiHistoryDelete: (id: string) => window.tverskoy.invoke<boolean>('ai:historyDelete', id),
  serversList: () => window.tverskoy.invoke<ServerInfo[]>('servers:list'),
  serversOnline: () => window.tverskoy.invoke<ServerInfo[]>('servers:online'),
  wikiNav: () => window.tverskoy.invoke<WikiSection[]>('wiki:nav'),
  wikiList: (section: string, q: string, offset: number) =>
    window.tverskoy.invoke<WikiListItem[]>('wiki:list', { section, q, offset }),
  wikiSearch: (q: string) => window.tverskoy.invoke<WikiListItem[]>('wiki:search', q),
  wikiEntry: (id: string) => window.tverskoy.invoke<WikiEntry | null>('wiki:entry', id),
  settingsGet: () => window.tverskoy.invoke<Settings>('settings:get'),
  settingsSet: (patch: Partial<Settings>) => window.tverskoy.invoke<Settings>('settings:set', patch),
  voiceTranscribe: () => window.tverskoy.invoke<{ ok: boolean; error?: string; text?: string }>('voice:transcribe'),
  windowHide: () => window.tverskoy.send('window:hide'),
  windowDrag: (phase: 'start' | 'move' | 'end') => window.tverskoy.send('window:drag', phase),
  windowWiki: (on: boolean) => window.tverskoy.send('window:wiki', on),
  openExternal: (url: string) => window.tverskoy.send('window:openExternal', url),
  aiwinOpen: () => window.tverskoy.send('aiwin:open'),
  aiwinHide: () => window.tverskoy.send('aiwin:hide'),
  reportError: (message: string) => window.tverskoy.send('error:report', { message })
}

export type { RuleHit, NickVerdict }
