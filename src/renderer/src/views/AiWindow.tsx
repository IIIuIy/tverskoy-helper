import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { AiEvent, AiMessage, AccountState, AppInfo, ProjectInfo, SearchResponse, Settings, WikiCard } from '../../../shared/types'

export function AiWindow(): React.JSX.Element {
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState('')
  const [account, setAccount] = useState<AccountState | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<Array<{ id: string; question: string; answer: string; at: string }>>([])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void api.accountGet().then(setAccount)
    const off = window.tverskoy.on('account:state', (payload) => setAccount(payload as AccountState))

    const offAi = window.tverskoy.on('ai:event', (payload) => {
      const event = payload as AiEvent
      setMessages((prev) => {
        if (event.type === 'start') {
          if (prev.some((m) => m.id === event.id)) return prev
          return [
            ...prev,
            { id: event.id, role: 'user', text: event.query, status: 'done' },
            { id: `${event.id}-a`, role: 'assistant', text: '', status: 'running' }
          ]
        }
        const key = `${event.id}-a`
        return prev.map((m) => {
          if (m.id !== key) return m
          if (event.type === 'delta') return { ...m, text: m.text + event.text, status: 'running' }
          if (event.type === 'done') return { ...m, text: event.text, status: 'done', ms: event.ms, wiki: event.wiki ?? [] }
          return { ...m, status: 'error', error: event.message }
        })
      })
    })
    return () => {
      off()
      offAi()
    }
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  const ask = useCallback(
    (text: string) => {
      const q = text.trim()
      if (!q) return
      setInput('')
      const nickMode = /^(?:проверь ник|проверка ника|ник)\s/i.test(q) || /^[A-Za-zА-Яа-яЁё]+_[A-Za-zА-Яа-яЁё]+$/.test(q)
      void api.aiAnalyze(q, nickMode ? { mode: 'nick' } : undefined).catch((err) => {
        setMessages((prev) => [
          ...prev,
          { id: `err_${Date.now()}`, role: 'assistant', text: '', status: 'error', error: String(err) }
        ])
      })
    },
    []
  )

  const send = useCallback(() => ask(input), [ask, input])

  const loadHistory = useCallback(async () => {
    const items = await api.aiHistory()
    setHistory(items)
    setShowHistory(true)
  }, [])

  const feedback = useCallback(async (id: string, verdict: 'up' | 'down') => {
    await api.aiFeedback(id.replace(/-a$/, ''), verdict)
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback: verdict } : m)))
  }, [])

  return (
    <div className="root ai">
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
        <span className="brand">Tverskoy · ИИ</span>
        <span className="spacer" />
        <button className="icon" title="История" onClick={() => void loadHistory()}>⏱</button>
        <button className="icon" title="Скрыть" onClick={() => api.aiwinHide()}>✕</button>
      </header>

      {showHistory ? (
        <div className="history">
          {history.length === 0 && <div className="empty">История пуста.</div>}
          {history.map((h) => (
            <div key={h.id} className="history-item">
              <div className="q">{h.question}</div>
              <div className="a">{h.answer.slice(0, 140)}…</div>
              <button className="link" onClick={() => void api.aiHistoryDelete(h.id)}>удалить</button>
            </div>
          ))}
          <button className="btn" onClick={() => setShowHistory(false)}>← К диалогу</button>
        </div>
      ) : (
        <div className="messages" ref={listRef}>
          {messages.length === 0 && (
            <div className="empty">
              Спросите что-нибудь про правила: «что такое DM», «грабёж», «проверь ник Ivan_Petrov».
              {account?.quota && (
                <div className="quota">
                  Квота: {account.quota.remaining} из {account.quota.limit}
                </div>
              )}
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.role} ${m.status}`}>
              {m.status === 'running' && <span className="cursor">▍</span>}
              {m.text}
              {m.status === 'error' && <div className="error">{m.error}</div>}
              {m.status === 'done' && m.wiki && m.wiki.length > 0 && (
                <div className="wiki-cards">
                  {m.wiki.map((w: WikiCard) => (
                    <button key={w.id} className="wiki-card" onClick={() => api.windowWiki(true)}>
                      📖 {w.title}
                    </button>
                  ))}
                </div>
              )}
              {m.status === 'done' && m.role === 'assistant' && (
                <div className="fb">
                  <button className={`icon ${m.feedback === 'up' ? 'active' : ''}`} onClick={() => void feedback(m.id, 'up')}>👍</button>
                  <button className={`icon ${m.feedback === 'down' ? 'active' : ''}`} onClick={() => void feedback(m.id, 'down')}>👎</button>
                  {m.ms != null && <span className="ms">{m.ms} мс</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!showHistory && (
        <footer className="composer">
          <input
            autoFocus
            placeholder="Спросите о правилах…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <button className="btn primary" onClick={send}>Спросить</button>
        </footer>
      )}
    </div>
  )
}
