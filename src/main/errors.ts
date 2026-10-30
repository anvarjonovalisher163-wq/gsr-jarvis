import type { AppErrorShape } from '@shared/errors'

/**
 * Foydalanuvchiga ko'rsatish mumkin bo'lgan xato. Handler'lar shuni tashlaydi,
 * ipc.ts uni envelope ichida renderer'ga yuboradi.
 */
export class AppError extends Error {
  code: string
  retryAfter?: number

  constructor(code: string, message: string, retryAfter?: number) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.retryAfter = retryAfter
  }

  toShape(): AppErrorShape {
    return { code: this.code, message: this.message, retryAfter: this.retryAfter }
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError
