import type { AccountView } from '@shared/ipc'
import type { PublicAccount } from '@shared/types'
import { accountsRepo } from '../../db/repositories'
import { clientManager } from './clientManager'
import { avatarUrl } from './avatars'

export function toAccountView(a: PublicAccount): AccountView {
  return { ...a, connected: clientManager.isConnected(a.id), avatarUrl: avatarUrl(a.id) }
}

export function listAccountViews(): AccountView[] {
  return accountsRepo.listPublic().map(toAccountView)
}
