import { app, globalShortcut, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { initLog } from './log'
import { loadAppConfig } from './config'
import { loadSettings, applySystemSettings } from './settings'
import { createBackend } from './backend/live'
import { registerIpc } from './ipc'
import { togglePanel, openAiWindow } from './windows'

const appRoot = path.join(__dirname, '../..')
app.setAppUserModelId('ru.tverskoy.helper')

const log = initLog()
let backendInstance: ReturnType<typeof createBackend> | null = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    togglePanel()
  })
}

// Отключение ускорения по настройке — читаем до ready
try {
  const s = loadSettings()
  if (s.hardwareAcceleration === false) app.disableHardwareAcceleration()
} catch {
  // настройки не читаются — продолжаем
}

const isSmoke = process.argv.includes('--smoke')
const screenshotArg = process.argv.find((a) => a.startsWith('--screenshot='))

app.whenReady().then(() => {
  const config = loadAppConfig()
  const settings = loadSettings()
  applySystemSettings(settings)
  log(`start v${app.getVersion()}; проект: ${settings.project}; режим: ${config.apiBase ? 'live' : 'mock'}`)

  backendInstance = createBackend(config, loadSettings)

  registerIpc({
    backend: backendInstance,
    log,
    reRegisterHotkey: registerHotkey
  })

  registerHotkey()

  if (screenshotArg) {
    const file = screenshotArg.slice('--screenshot='.length)
    const wantAi = process.argv.includes('--view=ai')
    setTimeout(() => {
      if (wantAi) {
        openAiWindow()
      } else {
        togglePanel()
      }
      setTimeout(async () => {
        const all = BrowserWindow.getAllWindows()
        const win = wantAi ? all.find((w) => w.getTitle() === 'Ответ ИИ') ?? all[0] : all[0]
        const fill = process.argv.find((a) => a.startsWith('--fill='))
        if (win && !win.isDestroyed()) {
          if (fill) {
            const text = fill.slice('--fill='.length)
            const res = await win.webContents.executeJavaScript(`(() => {
              const input = document.querySelector('.searchbar input, .composer input')
              if (!input) return JSON.stringify({ found: false, hash: location.hash, body: document.body.innerText.slice(0, 150) })
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
              setter.call(input, ${JSON.stringify(text)})
              input.dispatchEvent(new Event('input', { bubbles: true }))
              return 'filled: ' + input.value
            })()`)
            log(`fill: ${res}`)
            await new Promise((r) => setTimeout(r, 900))
          }
          const img = await win.webContents.capturePage()
          fs.writeFileSync(file, img.toPNG())
          log(`скриншот сохранён: ${file}`)
        }
        BrowserWindow.getAllWindows().forEach((w) => w.destroy())
        app.exit(0)
      }, 2500)
    }, 1200)
  }

  app.on('activate', () => {
    togglePanel()
  })
})

function registerHotkey(): void {
  try {
    globalShortcut.unregisterAll()
    const hotkey = loadSettings().hotkey
    const ok = globalShortcut.register(hotkey, () => {
      togglePanel()
    })
    log(`хоткей ${hotkey}: ${ok ? 'зарегистрирован' : 'не удался'}`)
  } catch (err) {
    log(`хоткей не поставлен: ${err instanceof Error ? err.message : String(err)}`)
  }
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Панель и ИИ-окно закрываются в hide(), поэтому сюда доходим только при выходе
  app.quit()
})

if (isSmoke) {
  app.whenReady().then(() => {
    log('smoke: окно создаётся, выходим через 4 с')
    setTimeout(() => {
      BrowserWindow.getAllWindows().forEach((w) => w.destroy())
      app.exit(0)
    }, 4000)
  })
}

export { log, backendInstance, appRoot }
