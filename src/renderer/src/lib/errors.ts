import { isIpcError } from '@shared/errors'

/** IPC xatosidan foydalanuvchiga ko'rsatiladigan matn va kod. */
export function describeError(e: unknown): { code: string; message: string; retryAfter?: number } {
  if (isIpcError(e)) return { code: e.code, message: e.message, retryAfter: e.retryAfter }
  if (e instanceof Error) return { code: 'UNKNOWN', message: e.message }
  return { code: 'UNKNOWN', message: "Noma'lum xato." }
}
