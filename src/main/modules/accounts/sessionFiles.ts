import Database from 'better-sqlite3'
import AdmZip from 'adm-zip'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { basename, extname, join } from 'path'
import { createLogger } from '../../logger'

const log = createLogger('session-files')

/**
 * Boshqa dasturlardan sessiya fayllarini GramJS/Telethon StringSession'ga aylantirish.
 *  - Telethon .session (SQLite: sessions(dc_id, server_address, port, auth_key))
 *  - Pyrogram .session (SQLite: sessions(dc_id, api_id, test_mode, auth_key, user_id, is_bot))
 *  - .json (ichida session/string_session/session_string maydoni bo'lsa)
 *  - .zip — ichidagi .session/.json fayllar
 * Telegram Desktop tdata qo'llanmaydi (boshqa shifrlash formati).
 */

export interface ParsedSession {
  /** Fayl nomi (natijada ko'rsatish uchun). */
  label: string
  session: string
}

export interface ParseFailure {
  label: string
  error: string
}

/** Pyrogram faqat dc_id saqlaydi — production DC manzillari. */
const DC_IPS: Record<number, string> = {
  1: '149.154.175.53',
  2: '149.154.167.51',
  3: '149.154.175.100',
  4: '149.154.167.91',
  5: '91.108.56.130'
}

/** Telethon ko'rinishidagi string session: '1' + base64(dc(1) + ipv4(4) + port(2, BE) + authKey(256)). */
export function buildStringSession(
  dcId: number,
  ip: string,
  port: number,
  authKey: Buffer
): string {
  const ipParts = ip.split('.').map((p) => Number(p))
  if (ipParts.length !== 4 || ipParts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new Error(`Server manzili noto'g'ri: ${ip}`)
  }
  if (authKey.length !== 256)
    throw new Error(`auth_key uzunligi ${authKey.length} (256 bo'lishi kerak)`)
  const portBuf = Buffer.alloc(2)
  portBuf.writeUInt16BE(port)
  return (
    '1' +
    Buffer.concat([Buffer.from([dcId]), Buffer.from(ipParts), portBuf, authKey]).toString('base64')
  )
}

function fromSqlite(path: string): string {
  const db = new Database(path, { readonly: true, fileMustExist: true })
  try {
    const cols = (db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[]).map(
      (c) => c.name
    )
    if (cols.length === 0)
      throw new Error("'sessions' jadvali topilmadi — bu Telethon/Pyrogram sessiyasi emas.")
    const row = db.prepare('SELECT * FROM sessions LIMIT 1').get() as
      Record<string, unknown> | undefined
    if (!row) throw new Error("Sessiya bo'sh (akkauntga kirilmagan).")
    const authKey = row.auth_key
    if (!Buffer.isBuffer(authKey)) throw new Error("auth_key yo'q.")
    const dcId = Number(row.dc_id)
    if (cols.includes('server_address')) {
      // Telethon
      return buildStringSession(dcId, String(row.server_address), Number(row.port) || 443, authKey)
    }
    // Pyrogram
    if (row.test_mode) throw new Error("Test-server sessiyasi qo'llanmaydi.")
    if (row.is_bot)
      throw new Error('Bu bot sessiyasi — botlar "Botlar" bo\'limida token bilan qo\'shiladi.')
    const ip = DC_IPS[dcId]
    if (!ip) throw new Error(`Noma'lum DC: ${dcId}`)
    return buildStringSession(dcId, ip, 443, authKey)
  } finally {
    db.close()
  }
}

const STRING_RE = /^1[A-Za-z0-9+/=_-]{40,}$/

function fromJson(path: string): string | null {
  const data = JSON.parse(readFileSync(path, 'utf8')) as unknown
  const pick = (o: unknown): string | null => {
    if (!o || typeof o !== 'object') return null
    const r = o as Record<string, unknown>
    for (const k of [
      'session',
      'string_session',
      'session_string',
      'stringSession',
      'sessionString'
    ]) {
      const v = r[k]
      if (typeof v === 'string' && STRING_RE.test(v.trim())) return v.trim()
    }
    return null
  }
  return pick(data)
}

export interface ParseOutcome {
  sessions: ParsedSession[]
  failures: ParseFailure[]
}

/** Tanlangan fayllarni o'qiydi. Zip vaqtinchalik papkaga ochiladi va o'chiriladi. */
export function parseSessionFiles(paths: string[]): ParseOutcome {
  const out: ParseOutcome = { sessions: [], failures: [] }
  // Bir xil nomdagi .session + .json juftida .json faqat metadata — sessiya .session'dan olinadi
  const sessionStems = new Set(
    paths.filter((p) => extname(p).toLowerCase() === '.session').map((p) => basename(p, '.session'))
  )

  const one = (path: string, label: string) => {
    const ext = extname(path).toLowerCase()
    try {
      if (ext === '.session') {
        out.sessions.push({ label, session: fromSqlite(path) })
      } else if (ext === '.json') {
        if (sessionStems.has(basename(path, '.json'))) return
        const s = fromJson(path)
        if (s) out.sessions.push({ label, session: s })
        else
          out.failures.push({
            label,
            error: 'JSON ichida sessiya satri topilmadi (faqat metadata).'
          })
      } else if (ext === '.txt') {
        const lines = readFileSync(path, 'utf8')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
        const found = lines.filter((l) => STRING_RE.test(l))
        if (!found.length)
          out.failures.push({ label, error: 'Matnda StringSession satri topilmadi.' })
        found.forEach((s, i) =>
          out.sessions.push({ label: found.length > 1 ? `${label} #${i + 1}` : label, session: s })
        )
      } else {
        out.failures.push({ label, error: `Qo'llanmaydigan fayl turi: ${ext || 'kengaytmasiz'}` })
      }
    } catch (e) {
      out.failures.push({ label, error: e instanceof Error ? e.message : String(e) })
    }
  }

  for (const p of paths) {
    if (extname(p).toLowerCase() === '.zip') {
      const dir = mkdtempSync(join(tmpdir(), 'tgm-import-'))
      try {
        const zip = new AdmZip(p)
        const entries = zip
          .getEntries()
          .filter((e) => !e.isDirectory && /\.(session|json|txt)$/i.test(e.entryName))
        if (!entries.length)
          out.failures.push({ label: basename(p), error: "Zip ichida .session/.json fayl yo'q." })
        const stems = new Set(
          entries
            .filter((e) => /\.session$/i.test(e.entryName))
            .map((e) => basename(e.entryName, '.session'))
        )
        for (const e of entries) {
          const name = basename(e.entryName)
          if (/\.json$/i.test(name) && stems.has(basename(name, '.json'))) continue
          const target = join(dir, `${out.sessions.length + out.failures.length}-${name}`)
          writeFileSync(target, e.getData())
          one(target, `${basename(p)}/${name}`)
        }
      } catch (e) {
        out.failures.push({
          label: basename(p),
          error: `Zip ochilmadi: ${e instanceof Error ? e.message : String(e)}`
        })
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    } else {
      one(p, basename(p))
    }
  }
  log.info(`Sessiya fayllari: ${out.sessions.length} ta topildi, ${out.failures.length} ta xato`)
  return out
}
