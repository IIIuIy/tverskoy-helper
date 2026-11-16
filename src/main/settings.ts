import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { Settings } from '../shared/types'

const DEFAULTS: Settings = {
  hotkey: 'Ctrl+Alt+T',
  pinned: false,
  autostart: false,
  confirmAi: true,
  streamerMode: false,
  hardwareAcceleration: true,
  project: 'majestic',
  server: {}
}

let settings: Settings = { ...DEFAULTS }
let loaded = false

function file(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): Settings {
  if (loaded) return settings
  try {
    const raw = JSON.parse(fs.readFileSync(file(), 'utf8')) as Partial<Settings>
    settings = { ...DEFAULTS, ...raw }
    if (!settings.server || typeof settings.server !== 'object') settings.server = {}
  } catch {
    settings = { ...DEFAULTS }
  }
  loaded = true
  return settings
}

export function saveSettings(): void {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(file(), JSON.stringify(settings, null, 2), 'utf8')
  } catch {
    // не критично
  }
}

export function getSettings(): Settings {
  return loadSettings()
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const s = loadSettings()
  if (typeof patch.hotkey === 'string' && patch.hotkey.trim()) s.hotkey = patch.hotkey.trim()
  if (typeof patch.pinned === 'boolean') s.pinned = patch.pinned
  if (typeof patch.autostart === 'boolean') s.autostart = patch.autostart
  if (typeof patch.confirmAi === 'boolean') s.confirmAi = patch.confirmAi
  if (typeof patch.streamerMode === 'boolean') s.streamerMode = patch.streamerMode
  if (typeof patch.hardwareAcceleration === 'boolean') s.hardwareAcceleration = patch.hardwareAcceleration
  if (typeof patch.project === 'string' && patch.project.trim()) s.project = patch.project.trim()
  if (patch.server && typeof patch.server === 'object') {
    for (const [k, v] of Object.entries(patch.server)) {
      if (typeof v === 'string' || v === null) s.server[k] = v
    }
  }
  saveSettings()
  applySystemSettings(s)
  return s
}

export function applySystemSettings(s: Settings): void {
  try {
    app.setLoginItemSettings({ openAtLogin: s.autostart, args: [] })
  } catch {
    // игнорируем
  }
}
