import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

let stream: fs.WriteStream | null = null

export function initLog(): (msg: string) => void {
  try {
    const dir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `app-${new Date().toISOString().slice(0, 10)}.log`)
    stream = fs.createWriteStream(file, { flags: 'a' })
  } catch {
    stream = null
  }
  return (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`
    console.log(line)
    try {
      stream?.write(line + '\n')
    } catch {
      // лог не критичен
    }
  }
}
