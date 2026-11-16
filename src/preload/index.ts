import { contextBridge, ipcRenderer } from 'electron'

// Белые списки каналов — зеркальны registerIpc в main
const INVOKE_CHANNELS = new Set([
  'app:info',
  'projects:list',
  'project:set',
  'project:setServer',
  'account:get',
  'account:signIn',
  'account:signOut',
  'account:refresh',
  'search',
  'laws:search',
  'rules:changes',
  'rules:changesSeen',
  'ai:analyze',
  'ai:cancel',
  'ai:feedback',
  'ai:history',
  'ai:historyDelete',
  'servers:list',
  'servers:online',
  'wiki:nav',
  'wiki:list',
  'wiki:search',
  'wiki:entry',
  'voice:transcribe',
  'settings:get',
  'settings:set',
  'window:isShown'
])

const SEND_CHANNELS = new Set([
  'window:hide',
  'window:drag',
  'window:wiki',
  'window:openExternal',
  'aiwin:open',
  'aiwin:hide',
  'error:report',
  'ui:openWiki'
])

const EVENT_CHANNELS = new Set([
  'ai:event',
  'account:state',
  'window:shown',
  'window:hidden',
  'window:wikiSize',
  'settings:changed',
  'project:changed',
  'rules:changed',
  'ui:openRule',
  'ui:openLaw',
  'ui:openWiki'
])

const api = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (!INVOKE_CHANNELS.has(channel)) return Promise.reject(new Error(`Канал запрещён: ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  send: (channel: string, payload?: unknown): void => {
    if (!SEND_CHANNELS.has(channel)) throw new Error(`Канал запрещён: ${channel}`)
    ipcRenderer.send(channel, payload)
  },
  on: (event: string, cb: (payload: unknown) => void): (() => void) => {
    if (!EVENT_CHANNELS.has(event)) throw new Error(`Событие запрещено: ${event}`)
    const listener = (_e: Electron.IpcRendererEvent, payload: unknown): void => cb(payload)
    ipcRenderer.on(event, listener)
    return () => {
      ipcRenderer.removeListener(event, listener)
    }
  }
}

contextBridge.exposeInMainWorld('tverskoy', api)
