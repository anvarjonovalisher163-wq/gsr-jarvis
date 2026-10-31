import { BrowserWindow, dialog } from 'electron'
import { readFileSync } from 'fs'
import { extname } from 'path'
import { postsRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'

const log = createLogger('posting')
const MAX_POSTS = 500

/**
 * Postlarni fayldan import (qoralama sifatida):
 *  - .txt — postlar "---" qatori bilan ajratiladi; birinchi qator "# sarlavha" bo'lsa sarlavha
 *  - .json — [{ "title": "...", "text": "..." }, ...] yoki ["matn", ...]
 *  - .csv — har qator bitta post (title;text yoki faqat text)
 */
export async function importPostsFromFile(win: BrowserWindow | null): Promise<{ count: number }> {
  const opts: Electron.OpenDialogOptions = {
    title: 'Postlarni import qilish',
    properties: ['openFile'],
    filters: [{ name: 'Matn / JSON / CSV', extensions: ['txt', 'json', 'csv', 'md'] }]
  }
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (res.canceled || !res.filePaths[0]) return { count: 0 }
  const path = res.filePaths[0]
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  const items = parsePosts(raw, extname(path).toLowerCase())
  if (items.length === 0) throw new AppError('IMPORT_EMPTY', 'Faylda post topilmadi.')
  if (items.length > MAX_POSTS)
    throw new AppError('IMPORT_TOO_MANY', `Bir vaqtda ko'pi bilan ${MAX_POSTS} ta post.`)
  for (const p of items) postsRepo.create({ title: p.title, text: p.text, media_json: null })
  log.info(`${items.length} ta post import qilindi: ${path}`)
  return { count: items.length }
}

export function parsePosts(raw: string, ext: string): { title: string; text: string }[] {
  const out: { title: string; text: string }[] = []
  const push = (title: unknown, text: unknown) => {
    const t = String(text ?? '').trim()
    if (t)
      out.push({
        title: String(title ?? '')
          .trim()
          .slice(0, 200),
        text: t.slice(0, 4096)
      })
  }
  if (ext === '.json') {
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      throw new AppError('IMPORT_FORMAT', "JSON noto'g'ri.")
    }
    if (!Array.isArray(data))
      throw new AppError(
        'IMPORT_FORMAT',
        'JSON massiv bo\'lishi kerak: [{"title":"...","text":"..."}]'
      )
    for (const it of data) {
      if (typeof it === 'string') push('', it)
      else if (it && typeof it === 'object')
        push(
          (it as Record<string, unknown>).title,
          (it as Record<string, unknown>).text ?? (it as Record<string, unknown>).message
        )
    }
    return out
  }
  if (ext === '.csv') {
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      const i = line.indexOf(';')
      if (i > 0 && i < 200) push(line.slice(0, i), line.slice(i + 1))
      else push('', line)
    }
    return out
  }
  for (const block of raw.split(/\r?\n\s*---+\s*\r?\n/)) {
    const lines = block.trim().split(/\r?\n/)
    if (!lines[0]?.trim()) continue
    if (lines[0].startsWith('# ')) push(lines[0].slice(2), lines.slice(1).join('\n'))
    else push('', block)
  }
  return out
}
