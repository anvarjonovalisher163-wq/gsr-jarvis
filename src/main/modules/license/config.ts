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
