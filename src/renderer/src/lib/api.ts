import type { RendererApi } from '@shared/ipc'
import { IpcError, type IpcEnvelope } from '@shared/errors'

/**
 * window.api (envelope qaytaradigan bridge) ustidan typed o'ram:
 * ok bo'lsa data, bo'lmasa IpcError (code, message, retryAfter) tashlaydi.
 *
 * Renderer'da faqat shu `api` ishlatiladi.
 */
type AnyFn = (...args: never[]) => Promise<IpcEnvelope<unknown>>

function unwrapNamespace<T extends Record<string, AnyFn>>(ns: T): { [K in keyof T]: unknown } {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(ns)) {
    const fn = ns[key]
    out[key] = async (...args: never[]) => {
      const env = await fn(...args)
      if (env.ok) return env.data
      throw new IpcError(env.error)
    }
  }
  return out as { [K in keyof T]: unknown }
}

const bridge = window.api

export const api: RendererApi = {
  app: unwrapNamespace(bridge.app) as RendererApi['app'],
  settings: unwrapNamespace(bridge.settings) as RendererApi['settings'],
  accounts: unwrapNamespace(bridge.accounts) as RendererApi['accounts'],
  channels: unwrapNamespace(bridge.channels) as RendererApi['channels'],
  posts: unwrapNamespace(bridge.posts) as RendererApi['posts'],
  media: unwrapNamespace(bridge.media) as RendererApi['media'],
  bots: unwrapNamespace(bridge.bots) as RendererApi['bots'],
  botRules: unwrapNamespace(bridge.botRules) as RendererApi['botRules'],
  subscribers: unwrapNamespace(bridge.subscribers) as RendererApi['subscribers'],
  broadcasts: unwrapNamespace(bridge.broadcasts) as RendererApi['broadcasts'],
  license: unwrapNamespace(bridge.license) as RendererApi['license'],
  updater: unwrapNamespace(bridge.updater) as RendererApi['updater'],
  on: bridge.on
}
