import {
  BrowserWindow,
  screen,
  app
} from 'electron'
import path from 'node:path'
import type { Settings } from '../shared/types'

const MIN_AI_W = 340
const MIN_AI_H = 232

export interface WindowDeps {
  getSettings: () => Settings
  log: (msg: string) => void
}

let panel: BrowserWindow | null = null
let aiWin: BrowserWindow | null = null
let dragStart: { cursorX: number; cursorY: number; winX: number; winY: number } | null = null
let deps: WindowDeps | null = null

export function initWindows(d: WindowDeps): void {
  deps = d
}

function rendererFile(): string {
  return path.join(__dirname, '../renderer/index.html')
}

function uiScale(work: Electron.Rectangle): number {
  const s = Math.min(work.width / 1920, work.height / 1080)
  return Math.round(Math.min(2, Math.max(1, s)) * 100) / 100
}

function currentDisplay(): Electron.Display {
  try {
    return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  } catch {
    return screen.getPrimaryDisplay()
  }
}

export function createPanel(): BrowserWindow {
  if (panel && !panel.isDestroyed()) return panel
  const disp = currentDisplay()
  const scale = uiScale(disp.workArea)
  const width = Math.min(Math.round(760 * scale), disp.workArea.width - 80)
  const height = Math.round(520 * scale)
  const s = deps?.getSettings()
  panel = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    thickFrame: false,
    autoHideMenuBar: true,
    title: 'Tverskoy Helper',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: !app.isPackaged,
      zoomFactor: scale,
      backgroundThrottling: false
    }
  })
  panel.setAlwaysOnTop(true, 'screen-saver')
  panel.setMenuBarVisibility(false)
  panel.on('blur', () => {
    // Скрываем при клике мимо, если не закреплено и нет AI-окна рядом
    const aiVisible = aiWin && !aiWin.isDestroyed() && aiWin.isVisible()
    if (!s?.pinned && !aiVisible && panel && !panel.isDestroyed() && panel.isVisible()) {
      hidePanel()
    }
  })
  panel.on('close', (e) => {
    e.preventDefault()
    panel?.hide()
  })
  panel.webContents.setWindowOpenHandler(({ url }) => {
    deps?.log(`внешняя ссылка заблокирована: ${url.slice(0, 120)}`)
    return { action: 'deny' }
  })
  panel.webContents.on('will-navigate', (e) => e.preventDefault())
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void panel.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void panel.loadFile(rendererFile())
  }
  return panel
}

export function placePanelNearCursor(win: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint()
  const disp = screen.getDisplayNearestPoint(cursor)
  const work = disp.workArea
  const [w, h] = win.getSize()
  let x = cursor.x - Math.round(w / 2)
  let y = cursor.y + 24
  x = Math.max(work.x + 8, Math.min(x, work.x + work.width - w - 8))
  if (y + h > work.y + work.height - 8) y = Math.max(work.y + 8, cursor.y - h - 24)
  win.setPosition(x, y)
}

export function showPanel(): boolean {
  const win = createPanel()
  const s = deps?.getSettings()
  placePanelNearCursor(win)
  win.showInactive()
  win.setIgnoreMouseEvents(false)
  win.focus()
  win.webContents.send('window:shown')
  deps?.log(`панель: показана (${s?.project ?? '?'})`)
  return true
}

export function hidePanel(): void {
  const win = panel && !panel.isDestroyed() ? panel : null
  if (!win) return
  win.webContents.send('window:hidden')
  win.hide()
  deps?.log('панель: скрыта')
}

export function togglePanel(): void {
  if (panel && !panel.isDestroyed() && panel.isVisible()) hidePanel()
  else showPanel()
}

export function isPanelVisible(): boolean {
  return !!(panel && !panel.isDestroyed() && panel.isVisible())
}

export function setWikiMode(on: boolean): void {
  const win = panel && !panel.isDestroyed() ? panel : null
  if (!win) return
  const disp = currentDisplay()
  const scale = uiScale(disp.workArea)
  const width = Math.min(Math.round((on ? 1040 : 760) * scale), disp.workArea.width - 80)
  const height = Math.round((on ? 680 : 520) * scale)
  const [x, y] = win.getPosition()
  const nx = Math.max(disp.workArea.x + 8, Math.min(x, disp.workArea.x + disp.workArea.width - width - 8))
  const ny = Math.max(disp.workArea.y + 8, Math.min(y, disp.workArea.y + disp.workArea.height - height - 8))
  win.setBounds({ x: nx, y: ny, width, height })
  win.webContents.send('window:wikiSize', { width: Math.round(width / scale), height: Math.round(height / scale) })
}

export function dragPanel(phase: 'start' | 'move' | 'end'): void {
  const win = panel && !panel.isDestroyed() ? panel : null
  if (!win) return
  const cursor = screen.getCursorScreenPoint()
  if (phase === 'start') {
    const [x, y] = win.getPosition()
    dragStart = { cursorX: cursor.x, cursorY: cursor.y, winX: x, winY: y }
    return
  }
  if (!dragStart) return
  if (phase === 'end') {
    const [x, y] = win.getPosition()
    deps?.log(`панель: перетащена на ${x - dragStart.winX}, ${y - dragStart.winY}`)
    dragStart = null
    return
  }
  win.setPosition(dragStart.winX + cursor.x - dragStart.cursorX, dragStart.winY + cursor.y - dragStart.cursorY)
}

// --- AI-окно ---

export function createAiWindow(): BrowserWindow {
  if (aiWin && !aiWin.isDestroyed()) return aiWin
  const disp = currentDisplay()
  const scale = uiScale(disp.workArea)
  const s = deps?.getSettings()
  aiWin = new BrowserWindow({
    width: Math.round(420 * scale),
    height: Math.round(320 * scale),
    minWidth: Math.round(MIN_AI_W * scale),
    minHeight: Math.round(MIN_AI_H * scale),
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    thickFrame: false,
    autoHideMenuBar: true,
    title: 'Ответ ИИ',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: !app.isPackaged,
      zoomFactor: scale,
      backgroundThrottling: false
    }
  })
  aiWin.setAlwaysOnTop(true, 'screen-saver')
  aiWin.setMenuBarVisibility(false)
  aiWin.on('close', (e) => {
    e.preventDefault()
    aiWin?.hide()
  })
  aiWin.on('blur', () => {
    if (!s?.pinned && aiWin && !aiWin.isDestroyed() && aiWin.isVisible() && !panel?.isFocused()) {
      hideAiWindow()
    }
  })
  aiWin.webContents.setWindowOpenHandler(({ url }) => {
    deps?.log(`внешняя ссылка заблокирована: ${url.slice(0, 120)}`)
    return { action: 'deny' }
  })
  aiWin.webContents.on('will-navigate', (e) => e.preventDefault())
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void aiWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}#ai`)
  } else {
    void aiWin.loadFile(rendererFile(), { hash: 'ai' })
  }
  return aiWin
}

export function openAiWindow(): void {
  const win = createAiWindow()
  if (!win.isVisible()) {
    const disp = currentDisplay()
    const work = disp.workArea
    const [w, h] = win.getSize()
    let x: number
    let y: number
    if (panel && !panel.isDestroyed() && panel.isVisible()) {
      const [px, py] = panel.getPosition()
      const [pw] = panel.getSize()
      x = px + pw + 12
      y = py
      if (x + w > work.x + work.width - 8) x = Math.max(work.x + 8, px - w - 12)
    } else {
      const cursor = screen.getCursorScreenPoint()
      x = cursor.x - Math.round(w / 2)
      y = cursor.y + 24
    }
    x = Math.max(work.x + 8, Math.min(x, work.x + work.width - w - 8))
    y = Math.max(work.y + 8, Math.min(y, work.y + work.height - h - 8))
    win.setPosition(x, y)
    win.showInactive()
    win.focus()
  } else {
    win.focus()
  }
  win.webContents.send('window:shown')
}

export function hideAiWindow(): void {
  if (aiWin && !aiWin.isDestroyed() && aiWin.isVisible()) {
    aiWin.webContents.send('window:hidden')
    aiWin.hide()
  }
}

export function isAiVisible(): boolean {
  return !!(aiWin && !aiWin.isDestroyed() && aiWin.isVisible())
}

// Трансляция событий обоим окнам
export function broadcast(event: string, payload?: unknown): void {
  for (const win of [panel, aiWin]) {
    if (win && !win.isDestroyed()) win.webContents.send(event, payload)
  }
}
