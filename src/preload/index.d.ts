import type { BridgeApi } from '@shared/ipc'

declare global {
  interface Window {
    /** Xom bridge. Renderer kodida to'g'ridan-to'g'ri ishlatmang — @renderer/lib/api dan foydalaning. */
    api: BridgeApi
    platform: NodeJS.Platform
  }
}

export {}
