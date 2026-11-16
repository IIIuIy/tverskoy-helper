// Live-клиент сервера (контракт из ТЗ, раздел 4).
// Пока заготовка: реальные вызовы будут включаться при apiBase в конфиге и живом сервере.

import type {
  AccountState,
  AiEvent,
  AppConfig,
  ChangesResponse,
  HistoryItem,
  NickVerdict,
  ProjectInfo,
  Quota,
  SearchResponse,
  ServerInfo,
  Settings,
  WikiEntry,
  WikiListItem,
  WikiSection
} from '../../shared/types'
import type { AnalyzeHandlers, Backend } from './mock'
import { MockBackend } from './mock'

export class LiveBackend implements Backend {
  readonly mode = 'live' as const
  private config: AppConfig
  private settings: () => Settings
  private baseUrl: string
  private access: { token: string; until: number } | null = null
  private refreshToken: string | null = null

  constructor(config: AppConfig, getSettings: () => Settings, baseUrl: string) {
    this.config = config
    this.settings = getSettings
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private async req<T>(path: string, init: RequestInit & { token?: boolean } = {}): Promise<T> {
    const headers = new Headers(init.headers)
    if (init.token !== false && this.access) headers.set('authorization', `Bearer ${this.access.token}`)
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  accountState(): AccountState {
    if (!this.refreshToken) return { status: 'signed-out', error: null }
    return { status: 'signed-in', quota: null, user: { id: '?', telegramId: 0, isPremium: false, role: 'user' } }
  }

  async signIn(): Promise<AccountState> {
    // TODO(фаза 3): POST /v1/auth/login {device, client} → sessionId/secret/code/botUrl,
    // окно входа через Telegram-бота, опрос статуса, /v1/auth/refresh → токены.
    return { status: 'signed-out', error: 'Вход через Telegram появится на фазе 3 (нужен живой сервер).' }
  }

  async signOut(): Promise<AccountState> {
    this.refreshToken = null
    this.access = null
    return { status: 'signed-out', error: null }
  }

  async refreshAccount(): Promise<AccountState> {
    return this.accountState()
  }

  async projectInfo(slug: string): Promise<ProjectInfo | null> {
    return this.req<ProjectInfo>(`/v1/app/project?project=${encodeURIComponent(slug)}`)
  }

  async search(slug: string, scope: 'rules' | 'laws', server: string | null, query: string, limit: number): Promise<SearchResponse> {
    const params = new URLSearchParams({ project: slug, scope, limit: String(limit), q: query })
    if (server) params.set('server', server)
    return this.req<SearchResponse>(`/v1/app/search?${params}`)
  }

  async changes(slug: string): Promise<ChangesResponse | null> {
    return this.req<ChangesResponse>(`/v1/app/changes?project=${encodeURIComponent(slug)}`)
  }

  async analyze(slug: string, server: string | null, query: string, handlers: AnalyzeHandlers): Promise<AiEvent | null> {
    // TODO(фаза 5): POST /v1/analyze (SSE): события start/delta/done/error + quota.
    throw new Error('Анализ ИИ будет включён на фазе 5 — нужен живой сервер.')
  }

  cancel(_id: string): void {
    // TODO: AbortController
  }

  async nickCheck(slug: string, nick: string): Promise<NickVerdict | null> {
    return this.req<NickVerdict>('/v1/nick', { method: 'POST', body: JSON.stringify({ project: slug, nick }) })
  }

  async history(slug: string, limit: number): Promise<HistoryItem[]> {
    return this.req<HistoryItem[]>(`/v1/history?project=${encodeURIComponent(slug)}&limit=${limit}`)
  }

  async historyDelete(slug: string, id: string): Promise<boolean> {
    await this.req(`/v1/history/${encodeURIComponent(id)}`, { method: 'DELETE' })
    return true
  }

  async feedback(id: string, verdict: 'up' | 'down' | null): Promise<boolean> {
    await this.req(`/v1/analyze/${encodeURIComponent(id)}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ verdict })
    })
    return true
  }

  async servers(slug: string): Promise<ServerInfo[]> {
    const info = await this.projectInfo(slug)
    return info?.rules.servers ?? []
  }

  async online(slug: string): Promise<ServerInfo[]> {
    return this.req<ServerInfo[]>(`/v1/app/online?project=${encodeURIComponent(slug)}`)
  }

  async wikiNav(): Promise<WikiSection[]> {
    return this.req<WikiSection[]>('/v1/app/wiki')
  }

  async wikiList(slug: string, section: string, q: string, offset: number): Promise<WikiListItem[]> {
    const params = new URLSearchParams({ project: slug, section, q, offset: String(offset), limit: '120', fv: '2' })
    return this.req<WikiListItem[]>(`/v1/app/wiki/list?${params}`)
  }

  async wikiSearch(slug: string, q: string): Promise<WikiListItem[]> {
    return this.req<WikiListItem[]>(`/v1/app/wiki/search?project=${encodeURIComponent(slug)}&q=${encodeURIComponent(q)}&limit=60`)
  }

  async wikiEntry(slug: string, id: string): Promise<WikiEntry | null> {
    return this.req<WikiEntry>(`/v1/app/wiki/entry/${encodeURIComponent(id)}?project=${encodeURIComponent(slug)}`)
  }
}

export function createBackend(config: AppConfig, getSettings: () => Settings): Backend {
  const base = config.apiBase || config.apiBaseEu
  if (base) return new LiveBackend(config, getSettings, base)
  // Пока своего сервера нет — работаем на моке (dev-режим по ТЗ, раздел 8, этап 3)
  return new MockBackend(config, getSettings)
}
