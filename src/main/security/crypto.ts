import { safeStorage } from 'electron'

/**
 * Electron safeStorage o'rami. Sessiya satrlari va bot tokenlari shu orqali
 * shifrlanib bazaga BLOB sifatida yoziladi.
 *
 * macOS'da Keychain, Windows'da DPAPI, Linux'da libsecret/kwallet ishlatiladi.
 * Shifrlash imkoni bo'lmasa (masalan, Linux'da keyring yo'q) aniq xato beramiz —
 * tokenlarni ochiq saqlash yo'q.
 */

function assertAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Tizimda shifrlash xizmati mavjud emas (safeStorage). Maxfiy ma\'lumotlarni saqlab bo\'lmaydi.'
    )
  }
}

export function encrypt(plain: string): Buffer {
  assertAvailable()
  return safeStorage.encryptString(plain)
}

export function decrypt(blob: Buffer): string {
  assertAvailable()
  return safeStorage.decryptString(Buffer.from(blob))
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/** Loglarga chiqarish uchun: tokenning boshi va oxirini ko'rsatadi, o'rtasi yashiriladi. */
export function mask(secret: string, visible = 4): string {
  if (secret.length <= visible * 2) return '*'.repeat(secret.length)
  return `${secret.slice(0, visible)}…${secret.slice(-visible)}`
}
