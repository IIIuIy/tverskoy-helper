// Mock-бэкенд: реализует контракт API из ТЗ локально, чтобы приложение
// работало без сервера (фаза разработки). Позже заменяется на live-клиент.

import type {
  AccountState,
  AiEvent,
  AiMessage,
  AppConfig,
  ChangesResponse,
  HistoryItem,
  NickVerdict,
  ProjectInfo,
  Quota,
  RuleEntry,
  RuleHit,
  SearchResponse,
  ServerInfo,
  Settings,
  WikiCard,
  WikiEntry,
  WikiListItem,
  WikiSection
} from '../../shared/types'

export interface AnalyzeHandlers {
  delta: (text: string) => void
  quota: (quota: Quota) => void
  signal: AbortSignal
}

export interface Backend {
  readonly mode: 'mock' | 'live'
  accountState(): AccountState
  signIn(): Promise<AccountState>
  signOut(): Promise<AccountState>
  refreshAccount(): Promise<AccountState>
  projectInfo(slug: string): Promise<ProjectInfo | null>
  search(slug: string, scope: 'rules' | 'laws', server: string | null, query: string, limit: number): Promise<SearchResponse>
  changes(slug: string): Promise<ChangesResponse | null>
  analyze(slug: string, server: string | null, query: string, handlers: AnalyzeHandlers, id?: string): Promise<AiEvent | null>
  cancel(id: string): void
  nickCheck(slug: string, nick: string): Promise<NickVerdict | null>
  history(slug: string, limit: number): Promise<HistoryItem[]>
  historyDelete(slug: string, id: string): Promise<boolean>
  feedback(id: string, verdict: 'up' | 'down' | null): Promise<boolean>
  servers(slug: string): Promise<ServerInfo[]>
  online(slug: string): Promise<ServerInfo[]>
  wikiNav(): Promise<WikiSection[]>
  wikiList(slug: string, section: string, q: string, offset: number): Promise<WikiListItem[]>
  wikiSearch(slug: string, q: string): Promise<WikiListItem[]>
  wikiEntry(slug: string, id: string): Promise<WikiEntry | null>
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ---------------- Данные ----------------

const NICK_RULE: ProjectInfo['nick'] = {
  num: '1.1',
  text: 'Никнейм должен быть формата «Имя Фамилия», без цифр, символов и нецензурной лексики.',
  bullets: [
    { key: 'format', text: 'Ник не соответствует формату «Имя Фамилия» (цифры, символы, одно слово).' },
    { key: 'admin', text: 'Ник имитирует ник администратора или известную личность.' },
    { key: 'profanity', text: 'Ник содержит нецензурную лексику или оскорбления.' },
    { key: 'politics', text: 'Ник содержит политические или религиозные отсылки.' },
    { key: 'meaningless', text: 'Ник не несёт смысловой нагрузки или несуразный.' }
  ],
  punishment: 'Предупреждение / изменение ника'
}

function rules(): RuleEntry[] {
  const doc = 'Общие серверные правила'
  const doc2 = 'Правила криминальных организаций'
  return [
    { docId: 'general', docTitle: doc, num: '1.1', title: 'Никнейм', text: 'Никнейм должен быть формата «Имя Фамилия», написан латиницей или кириллицей в зависимости от проекта. Цифры, символы и нецензурная лексика запрещены.', punishment: 'Предупреждение', repeat: 'Блокировка аккаунта' },
    { docId: 'general', docTitle: doc, num: '1.4', title: 'NonRP поведение', text: 'NonRP — действия, невозможные в реальной жизни: прыжки с высоты без причины, использование багов, отыгровка нереалистичных ситуаций.', punishment: 'Деморган до 60 минут', repeat: 'Деморган 120 минут' },
    { docId: 'general', docTitle: doc, num: '1.6', title: 'Чат и OOC', text: 'В чате запрещено оскорблять игроков, рекламировать сторонние проекты и обсуждать темы вне игры (OOC) без необходимости.', punishment: 'Мут 30 минут' },
    { docId: 'general', docTitle: doc, num: '2.1', title: 'DM (Deathmatch)', text: 'Убийство игрока без отыгровки причины запрещено. Перед атакой должна быть ролевая причина.', punishment: 'Деморган 30 минут' },
    { docId: 'general', docTitle: doc, num: '2.8', title: 'Грабёж', text: 'Грабёж игроков разрешён только вне безопасных зон и при соблюдении минимального баланса.', punishment: 'Деморган 60 минут' },
    { docId: 'crime', docTitle: doc2, num: '3.2', title: 'Захват территорий', text: 'Захват бизнесов и территорий криминальными организациями проходит по расписанию каптов. Использование багов запрещено.', punishment: 'Варн лидеру, откат захвата' },
    { docId: 'crime', docTitle: doc2, num: '3.7', title: 'Война банд', text: 'Нападение на членов враждующей организации разрешено только на общей территории и после объявления.', punishment: 'Деморган 45 минут' }
  ]
}

function laws(): ProjectInfo['laws'] {
  return [
    { slug: 'uk', title: 'Уголовный кодекс', collectedAt: '2026-01-12T10:00:00Z', lastEdited: '2026-02-01T08:30:00Z', docs: 1, articles: 214 },
    { slug: 'koap', title: 'Кодекс об административных правонарушениях', collectedAt: '2026-01-12T10:00:00Z', lastEdited: '2026-01-20T12:00:00Z', docs: 1, articles: 96 }
  ]
}

const WIKI_SECTIONS: WikiSection[] = [
  { id: 'posts', title: 'Статьи' },
  { id: 'items', title: 'Предметы' },
  { id: 'vehicles', title: 'Транспорт' },
  { id: 'clothes', title: 'Одежда' },
  { id: 'factions', title: 'Фракции' },
  { id: 'businesses', title: 'Бизнесы' },
  { id: 'changelogs', title: 'Обновления' }
]

const WIKI_ITEMS: WikiListItem[] = [
  { id: 'items:aptechka', title: 'Аптечка', section: 'items', price: 500, description: 'Восстанавливает здоровье полностью.' },
  { id: 'items:bronja', title: 'Бронежилет', section: 'items', price: 1200, description: 'Снижает урон по корпусу.' },
  { id: 'items:telefon', title: 'Телефон', section: 'items', price: 300, description: 'Звонки, SMS, банк и новости.' },
  { id: 'vehicles:elegy', title: 'Elegy RH8', section: 'vehicles', price: 45000, description: 'Спорткар, популярен для дрифта.' },
  { id: 'vehicles:sultan', title: 'Sultan RS', section: 'vehicles', price: 78000, description: 'Быстрый седан с хорошей управляемостью.' },
  { id: 'vehicles:sanchez', title: 'Sanchez', section: 'vehicles', price: 8900, description: 'Мотоцикл для бездорожья.' },
  { id: 'clothes:kostyum', title: 'Костюм «Гангстер»', section: 'clothes', price: 2500, description: 'Пиджак, брюки и шляпа.' },
  { id: 'factions:pd', title: 'Полиция (LSPD)', section: 'factions', description: 'Государственная фракция, охрана порядка.' },
  { id: 'factions:med', title: 'Медики (EMS)', section: 'factions', description: 'Государственная фракция, спасение жизней.' },
  { id: 'businesses:24-7', title: 'Магазин 24/7', section: 'businesses', price: 350000, description: 'Доход с покупателей.' }
]

const WIKI_PAGES: Record<string, string[]> = {
  'items:aptechka': ['Полный восстановитель здоровья.', 'Продаётся в аптеках и у медиков.', 'Использование: клавиша «B» (по умолчанию).'],
  'vehicles:elegy': ['Класс: спорткар.', 'Цена в автосалоне: 45 000$', 'Тюнинг: доступен полный обвес.'],
  'factions:pd': ['Ранг: от кадета до шефа.', 'Обязанности: патруль, вызовы, аресты.']
}

// ---------------- Реализация ----------------

export class MockBackend implements Backend {
  readonly mode = 'mock' as const
  private config: AppConfig
  private settings: () => Settings
  private quota: Quota = { limit: 120, used: 12, remaining: 108 }
  private historyByProject = new Map<string, HistoryItem[]>()
  private currentAi = new Map<string, AbortController>()
  private searchCache = new Map<string, { at: number; value: SearchResponse }>()
  private ruleVersion = 3

  constructor(config: AppConfig, getSettings: () => Settings) {
    this.config = config
    this.settings = getSettings
  }

  accountState(): AccountState {
    const user = { id: 'u1', telegramId: 100000001, username: 'tverskoy_player', firstName: 'Игрок', isPremium: false, role: 'user' }
    return { status: 'signed-in', user, quota: this.quota }
  }

  async signIn(): Promise<AccountState> {
    await wait(400)
    return this.accountState()
  }

  async signOut(): Promise<AccountState> {
    await wait(150)
    return { status: 'signed-out', error: null }
  }

  async refreshAccount(): Promise<AccountState> {
    return this.accountState()
  }

  async projectInfo(slug: string): Promise<ProjectInfo | null> {
    const proj = this.config.projects.find((p) => p.slug === slug)
    if (!proj) return null
    await wait(120)
    const rs = rules()
    return {
      project: slug,
      rules: {
        version: this.ruleVersion,
        ruleCount: rs.length,
        fetchedAt: '2026-02-10T09:00:00Z',
        checkedAt: '2026-02-10T09:00:00Z',
        docs: [
          { id: 'general', title: 'Общие серверные правила', ruleCount: 5 },
          { id: 'crime', title: 'Правила криминальных организаций', ruleCount: 2 }
        ],
        servers: proj.fallbackServers
      },
      laws: laws(),
      nick: NICK_RULE
    }
  }

  private findRules(server: string | null, query: string, limit: number): SearchResponse {
    const started = Date.now()
    const q = query.trim().slice(0, 300)
    const all = rules()
    const tokens = q.toLowerCase().split(/[\s,.;:!?]+/).filter(Boolean)
    const hits: RuleHit[] = []
    for (const rule of all) {
      const hay = `${rule.num} ${rule.title} ${rule.text}`.toLowerCase()
      const matched = tokens.filter((t) => hay.includes(t))
      if (tokens.length === 0 || matched.length === 0) continue
      const score = matched.length / tokens.length
      hits.push({
        rule,
        doc: { id: rule.docId, title: rule.docTitle, ruleCount: all.filter((r) => r.docId === rule.docId).length },
        score: Math.round(score * 100) / 100,
        matched
      })
    }
    hits.sort((a, b) => b.score - a.score || a.rule.num.localeCompare(b.rule.num))
    return { hits: hits.slice(0, limit), tookMs: Date.now() - started, total: hits.length, version: this.ruleVersion }
  }

  async search(slug: string, scope: 'rules' | 'laws', server: string | null, query: string, limit: number): Promise<SearchResponse> {
    const key = `${slug}|${scope}|${server ?? ''}|${query.trim().toLowerCase()}`
    const cached = this.searchCache.get(key)
    if (cached && Date.now() - cached.at < 2 * 60 * 1000) {
      this.searchCache.delete(key)
      this.searchCache.set(key, cached)
      return cached.value
    }
    await wait(80)
    // В mock-режиме законы ищутся по тем же правилам с пометкой в docTitle
    let value: SearchResponse
    if (scope === 'rules') {
      value = this.findRules(server, query, limit)
    } else {
      const base = this.findRules(server, query, limit)
      value = { ...base, hits: base.hits.map((h) => ({ ...h, doc: { ...h.doc, title: `Законодательство · ${h.doc.title}` } })) }
    }
    this.searchCache.set(key, { at: Date.now(), value })
    if (this.searchCache.size > 300) this.searchCache.delete(this.searchCache.keys().next().value as string)
    return value
  }

  async changes(): Promise<ChangesResponse> {
    await wait(60)
    return {
      versions: [
        { version: 3, at: '2026-02-10T09:00:00Z', changes: [{ ruleId: '1.7', kind: 'added' }] },
        { version: 2, at: '2026-01-28T09:00:00Z', changes: [{ ruleId: '2.8', kind: 'edited' }] },
        { version: 1, at: '2026-01-12T09:00:00Z', changes: [] }
      ]
    }
  }

  async analyze(slug: string, server: string | null, query: string, handlers: AnalyzeHandlers, clientId?: string): Promise<AiEvent | null> {
    const id = clientId ?? `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const started = Date.now()

    const found = await this.search(slug, 'rules', server, query, 3)
    const top = found.hits[0]?.rule
    const wikiCards: WikiCard[] = []
    const q = query.toLowerCase()
    for (const item of WIKI_ITEMS) {
      const title = item.title.toLowerCase()
      if (q.includes(title.split(' ')[0]) && wikiCards.length < 3) wikiCards.push({ id: item.id, title: item.title })
    }

    // Событие start
    await wait(120)
    if (handlers.signal.aborted) return null
    handlers.quota(this.quota)

    const parts: string[] = []
    if (/ник|nick|никнейм|имя/i.test(query)) {
      parts.push('### Проверка ника', '', 'Это задача «проверка ника» — введите: «проверь ник Имя_Фамилия», и я прогоню ник через правила.')
    } else if (top) {
      parts.push(
        '### Ответ',
        '',
        `По вашему вопросу применимо правило **п. ${top.num} — ${top.title}** (${top.docTitle}).`,
        '',
        top.text,
        '',
        `Наказание: ${top.punishment ?? 'не указано'}.`
      )
    } else {
      parts.push('### Ответ', '', 'По этому вопросу в правилах совпадений не нашлось. Уточните запрос — например, «что такое DM», «грабёж», «ник». ')
    }
    const text = parts.join('\n')

    // Стрим по кускам
    const chunks = text.match(/[\s\S]{1,40}/g) ?? [text]
    for (const chunk of chunks) {
      await wait(35)
      if (handlers.signal.aborted) return null
      handlers.delta(chunk)
    }

    this.quota = { ...this.quota, used: Math.min(this.quota.limit, this.quota.used + 1), remaining: Math.max(0, this.quota.remaining - 1) }

    const list = this.historyByProject.get(slug) ?? []
    list.unshift({ id, question: query, answer: text, at: new Date().toISOString() })
    this.historyByProject.set(slug, list.slice(0, 100))

    return { type: 'done', id, text, ms: Date.now() - started, wiki: wikiCards }
  }

  cancel(id: string): void {
    this.currentAi.get(id)?.abort()
    this.currentAi.delete(id)
  }

  async nickCheck(slug: string, nick: string): Promise<NickVerdict | null> {
    await wait(500)
    const proj = this.config.projects.find((p) => p.slug === slug)
    const alphabet = proj?.nickAlphabet === 'cyrillic' ? 'кириллицей' : 'латиницей'
    const clean = nick.trim()
    const parts = clean.split(/[\s_]+/).filter(Boolean)
    const hasDigits = /\d/.test(clean)
    const hasSymbols = /[^\p{L}'’\- ]/u.test(clean.replace(/[\s_]/g, ''))
    const twoWords = parts.length === 2
    const word = /^[\p{L}][\p{L}'’\-]*$/u

    if (!twoWords || hasDigits || hasSymbols || !parts.every((p) => word.test(p))) {
      return { verdict: 'nrp', bullet: 'format', reason: `Ник должен быть формата «Имя Фамилия», написан ${alphabet}, без цифр и символов.`, by: 'tverskoy-mock', rule: NICK_RULE }
    }
    const low = clean.toLowerCase()
    if (/admin|админ|модер|helper|хелпер|owner|developer/.test(low)) {
      return { verdict: 'doubt', reason: 'Ник похож на ник администрации — проверьте вручную.', by: 'tverskoy-mock', rule: NICK_RULE }
    }
    return { verdict: 'rp', reason: 'Формат «Имя Фамилия» соблюдён, нарушений нет.', by: 'tverskoy-mock', rule: NICK_RULE }
  }

  async history(slug: string, limit: number): Promise<HistoryItem[]> {
    await wait(80)
    return (this.historyByProject.get(slug) ?? []).slice(0, limit)
  }

  async historyDelete(_slug: string, id: string): Promise<boolean> {
    await wait(60)
    for (const [slug, list] of this.historyByProject) {
      this.historyByProject.set(slug, list.filter((h) => h.id !== id))
    }
    return true
  }

  async feedback(id: string, verdict: 'up' | 'down' | null): Promise<boolean> {
    await wait(60)
    return typeof id === 'string' && (verdict === 'up' || verdict === 'down' || verdict === null)
  }

  async servers(slug: string): Promise<ServerInfo[]> {
    const proj = this.config.projects.find((p) => p.slug === slug)
    return proj ? proj.fallbackServers.map((s) => ({ ...s })) : []
  }

  async online(slug: string): Promise<ServerInfo[]> {
    const base = await this.servers(slug)
    await wait(150)
    let seed = slug.length
    return base.map((s) => {
      seed = (seed * 31 + 7) % 9973
      return { ...s, players: 200 + (seed % 800), queued: seed % 25, status: true }
    })
  }

  async wikiNav(): Promise<WikiSection[]> {
    await wait(50)
    return WIKI_SECTIONS
  }

  private wikiFilter(list: WikiListItem[], q: string, offset: number, limit = 60): WikiListItem[] {
    const needle = q.trim().toLowerCase()
    const filtered = needle ? list.filter((i) => i.title.toLowerCase().includes(needle)) : list
    return filtered.slice(offset, offset + limit)
  }

  async wikiList(slug: string, section: string, q: string, offset: number): Promise<WikiListItem[]> {
    await wait(80)
    return this.wikiFilter(WIKI_ITEMS.filter((i) => i.section === section), q, offset, 120)
  }

  async wikiSearch(slug: string, q: string): Promise<WikiListItem[]> {
    await wait(80)
    return this.wikiFilter(WIKI_ITEMS, q, 0, 60)
  }

  async wikiEntry(_slug: string, id: string): Promise<WikiEntry | null> {
    await wait(80)
    const item = WIKI_ITEMS.find((i) => i.id === id)
    if (!item) return null
    const body = WIKI_PAGES[id] ?? [item.description ?? 'Описание появится позже.']
    return { id: item.id, title: item.title, section: item.section, body, image: null }
  }
}

// Вспомогательный экспорт для сообщений ИИ в рендере
export type { AiMessage }
