import type { UserProfile } from '@shared/outreach'
import { blacklistRepo, settingsRepo, templatesRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { handle } from '../../ipc'
import { addToBlacklist } from './blacklist'
import {
  accountQuota,
  campaignReport,
  deleteCampaign,
  listCampaigns,
  saveCampaign
} from './campaigns'
import { campaignRunner } from './campaignRunner'
import { listTemplates, saveTemplate } from './templates'

const PROFILE_KEYS = {
  name: 'profile.name',
  email: 'profile.email',
  phone: 'profile.phone'
} as const

export function getProfile(): UserProfile {
  return {
    name: settingsRepo.getOr(PROFILE_KEYS.name, ''),
    email: settingsRepo.getOr(PROFILE_KEYS.email, ''),
    phone: settingsRepo.getOr(PROFILE_KEYS.phone, '')
  }
}

export function registerOutreachIpc(): void {
  handle('templates:list', () => listTemplates())
  handle('templates:save', (_e, input) => saveTemplate(input))
  handle('templates:delete', (_e, { id }) => templatesRepo.remove(id))

  handle('blacklist:list', (_e, { search }) => blacklistRepo.list(search))
  handle('blacklist:add', (_e, input) => addToBlacklist(input))
  handle('blacklist:remove', (_e, { id }) => blacklistRepo.remove(id))

  handle('campaigns:list', (_e, { accountId }) => listCampaigns(accountId))
  handle('campaigns:get', (_e, { id }) => campaignReport(id))
  handle('campaigns:save', (_e, input) => saveCampaign(input))
  handle('campaigns:start', (_e, { id }) => campaignRunner.start(id))
  handle('campaigns:pause', (_e, { id }) => campaignRunner.pause(id))
  handle('campaigns:resume', (_e, { id }) => campaignRunner.start(id))
  handle('campaigns:cancel', (_e, { id }) => campaignRunner.cancel(id))
  handle('campaigns:delete', (_e, { id }) => deleteCampaign(id))
  handle('campaigns:quota', (_e, { accountId }) => accountQuota(accountId))

  handle('profile:get', () => getProfile())
  handle('profile:set', (_e, p) => {
    if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
      throw new AppError('PROFILE_EMAIL', "Email noto'g'ri.")
    settingsRepo.set(PROFILE_KEYS.name, p.name.trim())
    settingsRepo.set(PROFILE_KEYS.email, p.email.trim())
    settingsRepo.set(PROFILE_KEYS.phone, p.phone.trim())
    return getProfile()
  })
}
