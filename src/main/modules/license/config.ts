/**
 * Litsenziya serveri sozlamalari: build vaqtida .env (MAIN_VITE_*) dan,
 * yoki ish vaqtida TGM_* env orqali (test/dev uchun ustunlik beriladi).
 */
export interface LicenseConfig {
  url: string
  anonKey: string
  publicKey: string
}

export function licenseConfig(): LicenseConfig | null {
  const env = import.meta.env as unknown as Record<string, string | undefined>
  const url = (process.env.TGM_LICENSE_URL ?? env.MAIN_VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
  const anonKey = (process.env.TGM_LICENSE_ANON_KEY ?? env.MAIN_VITE_SUPABASE_ANON_KEY ?? '').trim()
  const publicKey = (process.env.TGM_LICENSE_PUBLIC_KEY ?? env.MAIN_VITE_LICENSE_PUBLIC_KEY ?? '').trim()
  if (!url || !publicKey) return null
  return { url, anonKey, publicKey }
}

/**
 * Egasi rejimi: ilova faqat o'z egasi uchun — litsenziya serveri va limitlar yo'q.
 * .env: MAIN_VITE_OWNER_MODE=1 (ixtiyoriy MAIN_VITE_OWNER_DEVICE_ID — faqat shu qurilmada).
 * Ish vaqtida TGM_OWNER_MODE / TGM_OWNER_DEVICE_ID ustunlik qiladi (test uchun).
 */
export function ownerMode(): { enabled: boolean; deviceId: string | null } {
  const env = import.meta.env as unknown as Record<string, string | undefined>
  const flag = (process.env.TGM_OWNER_MODE ?? env.MAIN_VITE_OWNER_MODE ?? '').trim()
  const deviceId = (process.env.TGM_OWNER_DEVICE_ID ?? env.MAIN_VITE_OWNER_DEVICE_ID ?? '').trim()
  return { enabled: flag === '1' || flag.toLowerCase() === 'true', deviceId: deviceId || null }
}
