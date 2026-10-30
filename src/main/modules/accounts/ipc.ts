import { Api } from 'telegram'
import { handle } from '../../ipc'
import { broadcast } from '../../events'
import { accountsRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'
import { clientManager } from './clientManager'
import { cancelLogin, check2FA, importSessions, sendCode, signIn } from './auth'
import { deleteAvatar } from './avatars'
import { listAccountViews } from './views'

const log = createLogger('accounts')

export function emitAccountsChanged(): void {
  broadcast('accounts:changed', listAccountViews())
}

export function registerAccountsIpc(): void {
  clientManager.setOnChange(emitAccountsChanged)

  handle('accounts:list', () => listAccountViews())

  handle('accounts:sendCode', (_e, { phone }) => sendCode(phone))
  handle('accounts:signIn', (_e, { code }) => signIn(code))
  handle('accounts:check2FA', (_e, { password }) => check2FA(password))
  handle('accounts:cancelLogin', () => cancelLogin())
  handle('accounts:importSessions', (_e, { sessions }) => importSessions(sessions))

  handle('accounts:logout', async (_e, { id }) => {
    const account = accountsRepo.getById(id)
    if (!account) throw new AppError('NOT_FOUND', 'Akkaunt topilmadi.')

    const client = clientManager.tryGetClient(id)
    if (client) {
      // Telegram tomonida ham sessiyani yopamiz; ulanmagan bo'lsa shunchaki o'tkazib yuboramiz
      await client.invoke(new Api.auth.LogOut()).catch((e) => log.warn(`LogOut xatosi (${id})`, e))
      await clientManager.disconnect(id)
    }
    accountsRepo.clearSession(id)
    log.info(`Akkaunt chiqdi: ${id} ${account.phone}`)
    emitAccountsChanged()
  })

  handle('accounts:remove', async (_e, { id }) => {
    const account = accountsRepo.getById(id)
    if (!account) throw new AppError('NOT_FOUND', 'Akkaunt topilmadi.')

    const client = clientManager.tryGetClient(id)
    if (client) {
      await client.invoke(new Api.auth.LogOut()).catch(() => {})
      await clientManager.disconnect(id)
    }
    accountsRepo.remove(id)
    deleteAvatar('account', id)
    log.info(`Akkaunt o'chirildi: ${id} ${account.phone}`)
    emitAccountsChanged()
  })
}
