import { protocol } from 'electron'
import { AVATAR_SCHEME, registerAvatarProtocol } from './modules/accounts/avatars'
import { MEDIA_SCHEME } from '@shared/media'
import { registerMediaProtocol } from './modules/posting/media'

/**
 * Barcha maxsus sxemalar bitta joyda: registerSchemesAsPrivileged faqat BIR MARTA
 * va app ready'dan OLDIN chaqirilishi shart.
 */
export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: AVATAR_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ])
}

/** app.whenReady() dan KEYIN. */
export function registerProtocolHandlers(): void {
  registerAvatarProtocol()
  registerMediaProtocol()
}
