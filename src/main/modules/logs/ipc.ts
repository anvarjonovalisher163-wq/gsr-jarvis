import { BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'
import type { LogQuery } from '@shared/tasks'
import { handle } from '../../ipc'
import { logsRepo } from '../../db/repositories'

function toLines(q: LogQuery): { lines: string[]; count: number } {
  const rows = logsRepo.list({ ...q, limit: q.limit ?? 5000 }).reverse()
  const lines = rows.map((r) => `${r.created_at} [${r.level.toUpperCase().padEnd(5)}] [${r.module}] ${r.message}${r.meta_json ? ' ' + r.meta_json : ''}`)
  return { lines, count: rows.length }
}

export function registerLogsIpc(): void {
  handle('logs:list', (_e, q) => logsRepo.list({ ...q, limit: q.limit ?? 300 }))
  handle('logs:modules', () => logsRepo.modules())
  handle('logs:clear', () => logsRepo.clear())

  handle('logs:export', async (e, q) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const opts: Electron.SaveDialogOptions = {
      title: 'Loglarni eksport qilish',
      defaultPath: `tg-manager-logs-${new Date().toISOString().slice(0, 10)}.txt`,
      filters: [{ name: 'Matn', extensions: ['txt'] }]
    }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    const { lines, count } = toLines(q)
    if (res.canceled || !res.filePath) return { path: null, count }
    writeFileSync(res.filePath, lines.join('\n') + '\n', 'utf8')
    return { path: res.filePath, count }
  })
}
