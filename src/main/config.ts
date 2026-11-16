import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { AppConfig, ProjectConfig } from '../shared/types'

// Конфигурация по умолчанию — совпадает с config/app-config.json.
// Пользовательский config/app-config.json (в userData) перекрывает значения по ключам.

const DEFAULT_CONFIG: AppConfig = {
  apiBase: '',
  apiBaseEu: '',
  projects: [
    {
      slug: 'majestic',
      name: 'Majestic RP',
      tagline: 'GTA V · города США',
      initials: 'MJ',
      accent: '#f93a64',
      forumOrigin: 'https://forum.majestic-rp.ru',
      forumSections: [
        '/forums/general-server-rules/',
        '/forums/rules-of-criminal-organizations/',
        '/forums/rules-of-state-organizations/'
      ],
      serverCategory: 'Дополнительные серверные правила',
      serverNameRe: "^[A-Za-z .'-]+$",
      fallbackServers: [
        { slug: 'new-york', id: '636', name: 'New York' },
        { slug: 'detroit', id: '637', name: 'Detroit' },
        { slug: 'chicago', id: '638', name: 'Chicago' },
        { slug: 'los-angeles', id: '648', name: 'Los Angeles' },
        { slug: 'miami', id: '772', name: 'Miami' },
        { slug: 'las-vegas', id: '868', name: 'Las Vegas' },
        { slug: 'washington', id: '881', name: 'Washington' },
        { slug: 'dallas', id: '1003', name: 'Dallas' }
      ],
      pinnedRules: ['1.1', '1.4', '1.6'],
      nickAlphabet: 'latin',
      lawsNeedLogin: true,
      sharedKnowledge: true,
      onlineUrl: 'https://api.majestic-files.net/meta/servers?project=majestic&region=ru&isTest=false'
    },
    {
      slug: 'russia',
      name: 'Россия Онлайн',
      tagline: 'GTA V · Москва',
      initials: 'РО',
      accent: '#ea403d',
      forumOrigin: 'https://forum.russia.online',
      forumSections: [
        '/forums/general-server-rules/',
        '/forums/rules-of-criminal-organizations/',
        '/forums/rules-of-state-organizations/'
      ],
      serverCategory: 'Дополнительные серверные правила',
      serverNameRe: "^[А-ЯЁа-яё .'-]+$",
      fallbackServers: [
        { slug: 'downtown', id: '14', name: 'Downtown' },
        { slug: 'eclipse', id: '556', name: 'Eclipse' },
        { slug: 'rockford', id: '883', name: 'Rockford' },
        { slug: 'redwood', id: '1421', name: 'Redwood' },
        { slug: 'murrieta', id: '1689', name: 'Murrieta' },
        { slug: 'chiliad', id: '2094', name: 'Chiliad' }
      ],
      pinnedRules: ['1.3', '7.8'],
      nickAlphabet: 'cyrillic',
      lawsNeedLogin: true,
      sharedKnowledge: true
    },
    {
      slug: 'gta5rp',
      name: 'GTA5RP',
      tagline: 'GTA V · Лос-Сантос',
      initials: 'G5',
      accent: '#ff8600',
      forumOrigin: 'https://forum.gta5rp.com',
      forumSections: [
        '/forums/general-server-rules/',
        '/forums/rules-of-criminal-organizations/',
        '/forums/rules-of-state-organizations/'
      ],
      serverCategory: 'Игровые сервера',
      serverNameRe: "^[A-Za-z .'-]+$",
      fallbackServers: [
        { slug: 'downtown', id: '14', name: 'Downtown' },
        { slug: 'eclipse', id: '556', name: 'Eclipse' },
        { slug: 'rockford', id: '883', name: 'Rockford' },
        { slug: 'redwood', id: '1421', name: 'Redwood' },
        { slug: 'murrieta', id: '1689', name: 'Murrieta' },
        { slug: 'chiliad', id: '2094', name: 'Chiliad' },
        { slug: 'mirror', id: '2163', name: 'Mirror' },
        { slug: 'blaine', id: '2225', name: 'Blaine' }
      ],
      pinnedRules: ['1.1'],
      nickAlphabet: 'latin',
      lawsNeedLogin: true,
      sharedKnowledge: false,
      onlineViaServer: true
    }
  ]
}

let cached: AppConfig | null = null

function readJson(file: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

export function loadAppConfig(): AppConfig {
  if (cached) return cached
  let merged: AppConfig = structuredClone(DEFAULT_CONFIG)
  const candidates: string[] = []
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath ?? '', 'config', 'app-config.json'))
  } else {
    candidates.push(path.join(app.getAppPath(), 'config', 'app-config.json'))
  }
  // Пользовательский файл имеет приоритет
  candidates.push(path.join(app.getPath('userData'), 'app-config.json'))
  for (const file of candidates) {
    const data = readJson(file)
    if (!data) continue
    if (typeof data.apiBase === 'string') merged.apiBase = data.apiBase
    if (typeof data.apiBaseEu === 'string') merged.apiBaseEu = data.apiBaseEu
    if (Array.isArray(data.projects) && data.projects.length > 0) {
      const bySlug = new Map(merged.projects.map((p) => [p.slug, p]))
      for (const raw of data.projects as ProjectConfig[]) {
        if (!raw || typeof raw.slug !== 'string') continue
        const prev = bySlug.get(raw.slug)
        bySlug.set(raw.slug, { ...(prev ?? {}), ...raw } as ProjectConfig)
      }
      merged.projects = [...bySlug.values()]
    }
  }
  cached = merged
  return merged
}

export function getProject(slug: string): ProjectConfig | undefined {
  return loadAppConfig().projects.find((p) => p.slug === slug)
}
