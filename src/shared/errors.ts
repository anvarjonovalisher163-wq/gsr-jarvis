/**
 * IPC orqali o'tadigan xato shakli. Main'da AppError → shu shaklga aylantiriladi,
 * preload'da yana IpcError (Error) qilib renderer'ga tashlanadi.
 */
export interface AppErrorShape {
  /** Mashina uchun kod: 'PHONE_CODE_INVALID', 'FLOOD_WAIT', 'INTERNAL' ... */
  code: string
  /** Foydalanuvchiga ko'rsatiladigan o'zbekcha matn. */
  message: string
  /** FLOOD_WAIT va shunga o'xshash: necha soniya kutish kerak. */
  retryAfter?: number
}

export class IpcError extends Error {
  code: string
  retryAfter?: number

  constructor(shape: AppErrorShape) {
    super(shape.message)
    this.name = 'IpcError'
    this.code = shape.code
    this.retryAfter = shape.retryAfter
  }
}

export function isIpcError(e: unknown): e is IpcError {
  return e instanceof IpcError || (typeof e === 'object' && e !== null && 'code' in e && 'message' in e)
}

export type IpcEnvelope<T> = { ok: true; data: T } | { ok: false; error: AppErrorShape }
