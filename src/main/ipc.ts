// Регистрация IPC-каналов (белые списки продублированы в preload).

import { ipcMain, shell, globalShortcut, app } from 'electron'
import type { Backend } from './backend/mock'
import { loadAppConfig, getProject } from './config'
import { getSettings, updateSettings, type Settings } from './settings'
import {
  togglePanel,
  hidePanel,
  isPanelVisible,
  setWikiMode,
  dragPanel,
  openAiWindow,
  hideAiWindow,
  broadcast,
  initWindows
} from './windows'

export interface IpcDeps {
  backend: Backend
  log: (msg: string) => void
  reRegisterHotkey: () => void
}

const seenVersions = new Map<string, number | null>()
const aiControllers = new Map<string, AbortController>()

export function registerIpc(deps: IpcDeps): void {
  const { backend, log } = deps
  const config = loadAppConfig()
  const currentProject = (): string => getSettings().project

  initWindows({ getSettings, log })

  // --- Приложение ---
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    hotkey: getSettings().hotkey,
    platform: process.platform,
    mode: backend.mode
  }))

  // --- Проекты ---
  ipcMain.handle('projects:list', () => config.projects.map((p) => ({ slug: p.slug, name: p.name, tagline: p.tagline, initials: p.initials, accent: p.accent })))
  ipcMain.handle('project:set', (_e, slug: unknown) => {
    if (typeof slug === 'string' && config.projects.some((p) => p.slug === slug)) {
      updateSettings({ project: slug })
      broadcast('project:changed', slug)
    }
    return getSettings()
  })
  ipcMain.handle('project:setServer', (_e, server: unknown) => {
    const s = getSettings()
    const patch: Partial<Settings> = { server: { ...s.server, [currentProject()]: typeof server === 'string' ? server : null } }
    updateSettings(patch)
    return getSettings()
  })

  // --- Аккаунт ---
  ipcMain.handle('account:get', () => backend.accountState())
  ipcMain.handle('account:signIn', () => backend.signIn())
  ipcMain.handle('account:signOut', () => backend.signOut())
  ipcMain.handle('account:refresh', () => backend.refreshAccount())

  // --- Поиск ---
  ipcMain.handle('search', (_e, query: unknown, opts?: { server?: string | null; limit?: number }) => {
    const q = typeof query === 'string' ? query : ''
    const server = typeof opts?.server === 'string' ? opts.server : getSettings().server[currentProject()] ?? null
    const limit = Math.min(50, Math.max(1, Number(opts?.limit) || 30))
    if (!q.trim()) return { hits: [], tookMs: 0, total: 0, version: null }
    return backend.search(currentProject(), 'rules', server, q, limit)
  })
  ipcMain.handle('laws:search', (_e, query: unknown, opts?: { limit?: number }) => {
    const q = typeof query === 'string' ? query : ''
    const server = getSettings().server[currentProject()] ?? null
    const limit = Math.min(50, Math.max(1, Number(opts?.limit) || 30))
    if (!q.trim()) return { hits: [], tookMs: 0, total: 0, version: null }
    return backend.search(currentProject(), 'laws', server, q, limit)
  })

  // --- Правила: журнал изменений ---
  ipcMain.handle('rules:changes', async () => {
    const changes = await backend.changes(currentProject())
    const seen = seenVersions.get(currentProject())
    return { ...changes, seenAt: seen ?? null }
  })
  ipcMain.handle('rules:changesSeen', () => {
    void backend.changes(currentProject()).then((c) => {
      const latest = c?.versions[0]?.version
      if (typeof latest === 'number') {
        seenVersions.set(currentProject(), latest)
        broadcast('rules:changed')
      }
    })
    return true
  })

  // --- ИИ ---
  ipcMain.handle('ai:analyze', async (_e, query: unknown, opts?: { mode?: 'nick'; fresh?: boolean }) => {
    const q = typeof query === 'string' ? query.trim() : ''
    if (!q) return null
    if (opts?.mode === 'nick') {
      // Проверка ника: единичный запрос-ответ
      const verdict = await backend.nickCheck(currentProject(), q)
      const event = formatNickAnswer(q, verdict, getProject(currentProject()))
      broadcast('ai:event', event)
      return event
    }
    const id = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const server = getSettings().server[currentProject()] ?? null
    const abort = new AbortController()
    aiControllers.set(id, abort)
    const projectInfo = await backend.projectInfo(currentProject())
    broadcast('ai:event', {
      type: 'start',
      id,
      model: 'Tverskoy',
      query: q,
      contextRules: projectInfo?.rules.ruleCount ?? 0
    })
    const result = await backend.analyze(currentProject(), server, q, {
      signal: abort.signal,
      delta: (text) => broadcast('ai:event', { type: 'delta', id, text }),
      quota: (quota) => broadcast('account:state', { status: 'signed-in', quota })
    }, id)
    aiControllers.delete(id)
    if (result) {
      broadcast('ai:event', result)
      return result
    }
    broadcast('ai:event', { type: 'error', id, message: 'Отменено', code: 'cancelled' })
    return null
  })
  ipcMain.handle('ai:cancel', (_e, id: unknown) => {
    if (typeof id === 'string') {
      aiControllers.get(id)?.abort()
      aiControllers.delete(id)
      backend.cancel(id)
    }
    return true
  })
  ipcMain.handle('ai:feedback', (_e, id: unknown, verdict: unknown) => {
    const v = verdict === 'up' || verdict === 'down' ? verdict : null
    if (typeof id !== 'string') return false
    return backend.feedback(id, v)
  })
  ipcMain.handle('ai:history', () => backend.history(currentProject(), 50))
  ipcMain.handle('ai:historyDelete', (_e, id: unknown) => (typeof id === 'string' ? backend.historyDelete(currentProject(), id) : false))
  ipcMain.on('aiwin:open', () => openAiWindow())

  // --- Серверы ---
  ipcMain.handle('servers:list', () => backend.servers(currentProject()))
  ipcMain.handle('servers:online', () => backend.online(currentProject()))

  // --- Вики ---
  ipcMain.handle('wiki:nav', () => backend.wikiNav())
  ipcMain.handle('wiki:list', (_e, args?: { section?: unknown; q?: unknown; offset?: unknown }) => {
    const section = typeof args?.section === 'string' ? args.section : 'items'
    const q = typeof args?.q === 'string' ? args.q : ''
    const offset = Math.max(0, Number(args?.offset) || 0)
    return backend.wikiList(currentProject(), section, q, offset)
  })
  ipcMain.handle('wiki:search', (_e, q: unknown) => backend.wikiSearch(currentProject(), typeof q === 'string' ? q : ''))
  ipcMain.handle('wiki:entry', (_e, id: unknown) => (typeof id === 'string' ? backend.wikiEntry(currentProject(), id) : null))
  ipcMain.on('ui:openWiki', (_e, id: unknown) => {
    if (typeof id === 'string') broadcast('ui:openWiki', { id })
  })

  // --- Голос (фаза 7) ---
  ipcMain.handle('voice:transcribe', () => ({ ok: false, error: 'Голосовой ввод появится на фазе 7.' }))

  // --- Настройки ---
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch: unknown) => {
    const s = updateSettings(patch as Partial<Settings>)
    deps.reRegisterHotkey()
    broadcast('settings:changed', s)
    return s
  })

  // --- Окно ---
  ipcMain.on('window:hide', () => hidePanel())
  ipcMain.on('window:drag', (_e, phase: unknown) => {
    if (phase === 'start' || phase === 'move' || phase === 'end') dragPanel(phase)
  })
  ipcMain.on('window:wiki', (_e, on: unknown) => setWikiMode(on === true))
  ipcMain.handle('window:isShown', () => isPanelVisible())
  ipcMain.on('window:openExternal', (_e, url: unknown) => {
    if (typeof url === 'string' && /^https:\/\//i.test(url)) {
      void shell.openExternal(url).catch((err) => log(`ссылка не открылась: ${err.message}`))
    }
  })
  ipcMain.on('aiwin:hide', () => hideAiWindow())
  ipcMain.on('error:report', (_e, payload: unknown) => {
    const msg = typeof payload === 'object' && payload !== null && 'message' in payload ? String((payload as { message: unknown }).message) : String(payload)
    log(`ошибка окна: ${msg.slice(0, 200)}`)
  })
}

function formatNickAnswer(query: string, verdict: Awaited<ReturnType<Backend['nickCheck']>>, project: ReturnType<typeof getProject>): {
  type: 'done'
  id: string
  text: string
  ms: number
  wiki: never[]
} {
  const id = `nick_${Date.now()}`
  const nick = query.replace(/^(?:проверь|проверка|ник|nickname)\s*[:\-]?\s*/i, '').trim()
  const lines: string[] = []
  if (!verdict) {
    lines.push('### Ответ', '', 'Проверка ника недоступна — повторите позже.')
  } else if (verdict.verdict === 'rp') {
    lines.push('### Ответ', `**Подходит.** ${nick}: ${verdict.reason ?? 'обычные имя и фамилия'}, нарушений нет.`)
  } else if (verdict.verdict === 'nrp') {
    const bullet = verdict.rule.bullets.find((b) => b.key === verdict.bullet)
    lines.push(
      '### Ответ',
      `**Не подходит.** ${nick}: ${verdict.reason ?? bullet?.text ?? 'ник должен быть RP «Имя Фамилия»'}.`,
      verdict.rule.punishment ? `Наказание: ${verdict.rule.punishment}.` : ''
    )
    lines.push('### Пункты', `- п. ${verdict.rule.num} — ${verdict.rule.text}`)
    if (verdict.rule.repeat) lines.push('### Нюансы', `- Повтор: ${verdict.rule.repeat}`)
  } else {
    lines.push('### Ответ', `**Проверьте сами.** ${nick}: по формату подходит, но ${verdict.reason ?? 'есть сомнения'}.`)
  }
  if (project) lines.push('', `*Проект: ${project.name}; проверено моделью Tverskoy (${verdict?.by ?? '—'}).*`)
  return { type: 'done', id, text: lines.filter((l) => l !== '').join('\n'), ms: 500, wiki: [] as never[] }
}
