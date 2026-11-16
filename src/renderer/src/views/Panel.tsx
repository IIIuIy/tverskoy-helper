import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import type { AccountState, AppInfo, SearchResponse, ServerInfo, Settings } from '../../../shared/types'

type Tab = 'search' | 'wiki' | 'servers'

export function Panel(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [searching, setSearching] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [projects, setProjects] = useState<Array<{ slug: string; name: string; initials: string; accent: string }>>([])
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [account, setAccount] = useState<AccountState | null>(null)
  const [servers, setServers] = useState<ServerInfo[]>([])
  const [tab, setTab] = useState<Tab>('search')
  const [wikiSection, setWikiSection] = useState('items')
  const [wikiItems, setWikiItems] = useState<Array<{ id: string; title: string; price?: number; description?: string }>>([])
  const [showSettings, setShowSettings] = useState(false)
  const [showChanges, setShowChanges] = useState(false)
  const [changes, setChanges] = useState<Array<{ version: number; at: string; changes: Array<{ ruleId: string; kind: string }> }> | null>(null)
  const debounce = useRef<number | undefined>(undefined)

  useEffect(() => {
    void api.settingsGet().then(setSettings)
    void api.projectsList().then(setProjects)
    void api.appInfo().then(setInfo)
    void api.accountGet().then(setAccount)
    void api.serversList().then(setServers)
  }, [])

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults(null)
      return
    }
    void api.search(q, { limit: 30 }).then((r) => {
      setResults(r)
      setSearching(false)
    })
  }, [])

  const onInput = useCallback(
    (q: string) => {
      setQuery(q)
      setSearching(q.trim().length > 0)
      window.clearTimeout(debounce.current)
      debounce.current = window.setTimeout(() => doSearch(q), 250)
    },
    [doSearch]
  )

  const accent = useMemo(() => projects.find((p) => p.slug === settings?.project)?.accent ?? '#4f8cff', [projects, settings?.project])

  const openWiki = useCallback((on: boolean) => {
    api.windowWiki(on)
    setTab(on ? 'wiki' : 'search')
    if (on) void api.wikiList(wikiSection, '', 0).then(setWikiItems)
  }, [wikiSection])

  useEffect(() => {
    if (tab === 'wiki') void api.wikiList(wikiSection, '', 0).then(setWikiItems)
    if (tab === 'servers') void api.serversOnline().then(setServers)
  }, [tab, wikiSection])

  const currentServer = settings?.server?.[settings?.project ?? ''] ?? null

  return (
    <div className="root panel">
      <header
        className="titlebar"
        onPointerDown={(e) => {
          if (e.button === 0) {
            api.windowDrag('start')
            const move = (): void => api.windowDrag('move')
            const up = (): void => {
              api.windowDrag('end')
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', up)
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
          }
        }}
      >
        <span className="brand" style={{ color: accent }}>Tverskoy Helper</span>
        <select
          className="select"
          value={settings?.project ?? 'majestic'}
          onChange={(e) => void api.setProject(e.target.value).then(setSettings)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {projects.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>
        <select
          className="select"
          value={currentServer ?? ''}
          onChange={(e) => void api.setServer(e.target.value || null).then(setSettings)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <option value="">Все сервера</option>
          {servers.map((s) => (
            <option key={s.slug} value={s.name}>{s.name}</option>
          ))}
        </select>
        <span className="spacer" />
        <button className="icon" title="Журнал изменений" onClick={() => {
          void api.changesGet().then((c) => {
            setChanges(c?.versions ?? [])
            setShowChanges(true)
            void api.changesSeen()
          })
        }}>🔄</button>
        <button className="icon" title="Спросить ИИ" onClick={() => api.aiwinOpen()}>🤖</button>
        <button className="icon" title="Настройки" onClick={() => setShowSettings((v) => !v)}>⚙</button>
        <button className="icon" title="Скрыть" onClick={() => api.windowHide()}>✕</button>
      </header>

      {showSettings && settings && (
        <div className="settings">
          <label>Хоткей панели <input value={settings.hotkey} onChange={(e) => setSettings({ ...settings, hotkey: e.target.value })} /></label>
          <label><input type="checkbox" checked={settings.pinned} onChange={(e) => void api.settingsSet({ pinned: e.target.checked }).then(setSettings)} /> Не скрывать при клике мимо</label>
          <label><input type="checkbox" checked={settings.autostart} onChange={(e) => void api.settingsSet({ autostart: e.target.checked }).then(setSettings)} /> Автозапуск</label>
          <label><input type="checkbox" checked={settings.confirmAi} onChange={(e) => void api.settingsSet({ confirmAi: e.target.checked }).then(setSettings)} /> Подтверждать запросы ИИ</label>
          <label><input type="checkbox" checked={settings.streamerMode} onChange={(e) => void api.settingsSet({ streamerMode: e.target.checked }).then(setSettings)} /> Режим стримера</label>
          <div className="row">
            <button className="btn primary" onClick={() => { void api.settingsSet({ hotkey: settings.hotkey }); setShowSettings(false) }}>Сохранить</button>
            <span className="hint">режим: {info?.mode ?? '?'} · v{info?.version ?? '?'}</span>
          </div>
        </div>
      )}

      {showChanges && (
        <div className="changes">
          {changes?.map((v) => (
            <div key={v.version} className="change">
              <b>v{v.version}</b> · {new Date(v.at).toLocaleDateString()} ·{' '}
              {v.changes.length ? v.changes.map((c) => `${c.kind === 'added' ? '+' : c.kind === 'removed' ? '−' : '~'} п. ${c.ruleId}`).join(', ') : 'без изменений'}
            </div>
          ))}
          <button className="btn" onClick={() => setShowChanges(false)}>Закрыть</button>
        </div>
      )}

      <nav className="tabs">
        <button className={tab === 'search' ? 'tab active' : 'tab'} onClick={() => openWiki(false)}>Поиск</button>
        <button className={tab === 'wiki' ? 'tab active' : 'tab'} onClick={() => openWiki(true)}>Вики</button>
        <button className={tab === 'servers' ? 'tab active' : 'tab'} onClick={() => setTab('servers')}>Сервера</button>
      </nav>

      {tab === 'search' && (
        <>
          <div className="searchbar">
            <input
              autoFocus
              placeholder="Опишите ситуацию: грабёж, DM, ник…"
              value={query}
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  doSearch(query)
                }
                if (e.key === 'Escape') api.windowHide()
              }}
            />
            {searching && <span className="spin">…</span>}
          </div>
          <div className="results">
            {!results && <div className="empty">Введите запрос или откройте вики.</div>}
            {results?.hits.length === 0 && <div className="empty">Совпадений нет. Переформулируйте запрос.</div>}
            {results?.hits.map((h, i) => (
              <div key={`${h.rule.num}_${i}`} className="hit">
                <div className="hit-head">
                  <span className="num">п. {h.rule.num}</span>
                  <span className="doc">{h.rule.docTitle}</span>
                  <span className="spacer" />
                  <span className="score">{Math.round(h.score * 100)}%</span>
                </div>
                <div className="hit-title">{h.rule.title}</div>
                <div className="hit-text">{h.rule.text}</div>
                {h.rule.punishment && <div className="hit-pun">Наказание: {h.rule.punishment}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'wiki' && (
        <div className="wiki">
          <div className="wiki-sections">
            {['items', 'vehicles', 'clothes', 'factions', 'businesses', 'posts'].map((s) => (
              <button key={s} className={s === wikiSection ? 'chip active' : 'chip'} onClick={() => setWikiSection(s)}>{s}</button>
            ))}
          </div>
          <div className="wiki-list">
            {wikiItems.map((item) => (
              <div key={item.id} className="wiki-item">
                <b>{item.title}</b>
                {item.price != null && <span className="price">{item.price} $</span>}
                <div className="desc">{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'servers' && (
        <div className="serverlist">
          {servers.map((s) => (
            <div key={s.slug} className="server">
              <b>{s.name}</b>
              <span className="spacer" />
              <span className={s.status !== false ? 'online' : 'offline'}>{s.status !== false ? 'онлайн' : 'офлайн'}</span>
              <span className="players">{s.players ?? '—'} игроков</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
