import { BrowserWindow, dialog } from 'electron'
import { readFileSync } from 'fs'
import { extname } from 'path'
import bigInt from 'big-integer'
import { Api } from 'telegram'
import type { PhoneImportResult, TelegramContact } from '@shared/outreach'
import { settingsRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'
import { TELEGRAM_TIMEOUT_MS, withTimeout } from '../../utils/timeout'
import { clientManager } from '../accounts/clientManager'
import { mapTelegramError } from '../accounts/errors'
import { peerKeyOfEntity, remember } from '../chats/peers'

const log = createLogger('contacts')

/** Bir faylda / kuniga chegara — telefon kitobi hajmi, baza emas. */
const MAX_PER_FILE = 500
const MAX_PER_DAY = 500
const BATCH = 100
const KEY_DAY = 'contacts.import_day'
const KEY_COUNT = 'contacts.import_count'

interface PhoneEntry {
  name: string
  phone: string
}

function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, '')
  const digits = d.replace(/^\+/, '')
  if (!/^\d{7,15}$/.test(digits)) return null
  return `+${digits}`
}

/** .csv / .txt (ism,telefon | telefon,ism | faqat telefon) va .vcf (FN/TEL). */
export function parsePhoneFile(raw: string, ext: string): PhoneEntry[] {
  const out: PhoneEntry[] = []
  const seen = new Set<string>()
  const push = (name: string, phoneRaw: string) => {
    const phone = normalizePhone(phoneRaw)
    if (!phone || seen.has(phone)) return
    seen.add(phone)
    out.push({ name: name.trim().slice(0, 64) || phone, phone })
  }
  if (ext === '.vcf') {
    let name = ''
    for (const line of raw.split(/\r?\n/)) {
      if (/^BEGIN:VCARD/i.test(line)) name = ''
      else if (/^FN[:;]/i.test(line)) name = line.replace(/^FN[^:]*:/i, '')
      else if (/^TEL[:;]/i.test(line)) push(name, line.replace(/^TEL[^:]*:/i, ''))
    }
    return out
  }
  for (const line of raw.split(/\r?\n/)) {
    const cells = line.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, ''))
    if (cells.length === 0 || !line.trim()) continue
    const phoneIdx = cells.findIndex((c) => normalizePhone(c))
    if (phoneIdx < 0) continue
    const name = cells.filter((_, i) => i !== phoneIdx).join(' ')
    push(name, cells[phoneIdx])
  }
  return out
}

function todayCount(): number {
  const today = new Date().toISOString().slice(0, 10)
  if (settingsRepo.get(KEY_DAY) !== today) return 0
  return Number(settingsRepo.get(KEY_COUNT) ?? 0)
}
function addCount(n: number): void {
  const today = new Date().toISOString().slice(0, 10)
  settingsRepo.set(KEY_DAY, today)
  settingsRepo.set(KEY_COUNT, String(todayCount() + n))
}

/**
 * Telefon kitobini Telegram'ga import qilish (xuddi telefon ilovasidagi "kontaktlarni sinxronlash").
 * Faqat o'z tanishlaringiz uchun: fayl va kunlik chegara bor. Natija: Telegram'da bor/yo'q.
 */
export async function importPhoneContacts(
  accountId: number,
  win: BrowserWindow | null
): Promise<PhoneImportResult> {
  const client = clientManager.getClient(accountId)
  const opts: Electron.OpenDialogOptions = {
    title: 'Telefon kitobi faylini tanlash',
    properties: ['openFile'],
    filters: [{ name: 'CSV / TXT / VCF', extensions: ['csv', 'txt', 'vcf'] }]
  }
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (res.canceled || !res.filePaths[0])
    return { total: 0, imported: 0, notOnTelegram: 0, retry: 0, users: [] }
  const path = res.filePaths[0]
  const entries = parsePhoneFile(
    readFileSync(path, 'utf8').replace(/^﻿/, ''),
    extname(path).toLowerCase()
  )
  if (entries.length === 0) throw new AppError('IMPORT_EMPTY', 'Faylda telefon raqam topilmadi.')
  if (entries.length > MAX_PER_FILE)
    throw new AppError(
      'IMPORT_TOO_MANY',
      `Bir faylda ko'pi bilan ${MAX_PER_FILE} ta kontakt (telefon kitobi, baza emas).`
    )
  const left = MAX_PER_DAY - todayCount()
  if (left <= 0)
    throw new AppError(
      'IMPORT_DAILY_LIMIT',
      `Bugungi import chegarasi (${MAX_PER_DAY}) to'ldi. Ertaga davom eting.`
    )
  const todo = entries.slice(0, left)

  const result: PhoneImportResult = {
    total: todo.length,
    imported: 0,
    notOnTelegram: 0,
    retry: 0,
    users: []
  }
  try {
    for (let i = 0; i < todo.length; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH)
      const r = await withTimeout(
        client.invoke(
          new Api.contacts.ImportContacts({
            contacts: chunk.map(
              (c, j) =>
                new Api.InputPhoneContact({
                  clientId: bigInt(i + j),
                  phone: c.phone,
                  firstName: c.name,
                  lastName: ''
                })
            )
          })
        ),
        TELEGRAM_TIMEOUT_MS
      )
      result.imported += r.imported.length
      result.retry += r.retryContacts.length
      result.notOnTelegram += chunk.length - r.imported.length - r.retryContacts.length
      for (const u of r.users) {
        if (!(u instanceof Api.User)) continue
        const key = peerKeyOfEntity(u)
        remember(
          accountId,
          key,
          new Api.InputPeerUser({ userId: u.id, accessHash: u.accessHash ?? bigInt(0) }),
          u
        )
        result.users.push({
          peer: key,
          title: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.phone || key,
          username: u.username ?? null,
          phone: u.phone ? `+${u.phone}` : null,
          mutual: !!u.mutualContact
        })
      }
      addCount(chunk.length)
    }
  } catch (e) {
    throw mapTelegramError(e)
  }
  log.info(
    `Kontakt import (akkaunt ${accountId}): ${result.imported}/${result.total} Telegram'da, ${result.notOnTelegram} yo'q, ${result.retry} keyinroq`
  )
  return result
}

/** Akkauntning Telegram kontaktlari (o'zaro belgisi bilan). Kampaniya manbai sifatida faqat mutual ishlatiladi. */
export async function listTelegramContacts(accountId: number): Promise<TelegramContact[]> {
  const client = clientManager.getClient(accountId)
  try {
    const r = await withTimeout(
      client.invoke(new Api.contacts.GetContacts({ hash: bigInt(0) })),
      TELEGRAM_TIMEOUT_MS
    )
    if (!(r instanceof Api.contacts.Contacts)) return []
    const mutual = new Map(r.contacts.map((c) => [c.userId.toString(), c.mutual]))
    const out: TelegramContact[] = []
    for (const u of r.users) {
      if (!(u instanceof Api.User) || u.bot || u.self || u.deleted) continue
      const key = peerKeyOfEntity(u)
      remember(
        accountId,
        key,
        new Api.InputPeerUser({ userId: u.id, accessHash: u.accessHash ?? bigInt(0) }),
        u
      )
      out.push({
        peer: key,
        title: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.phone || key,
        username: u.username ?? null,
        phone: u.phone ? `+${u.phone}` : null,
        mutual: mutual.get(u.id.toString()) ?? !!u.mutualContact
      })
    }
    return out.sort((a, b) => Number(b.mutual) - Number(a.mutual) || a.title.localeCompare(b.title))
  } catch (e) {
    throw mapTelegramError(e)
  }
}
