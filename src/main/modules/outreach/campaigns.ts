import type {
  CampaignInput,
  CampaignReport,
  CampaignSettings,
  CampaignView
} from '@shared/outreach'
import { CAMPAIGN_BOUNDS, CAMPAIGN_DEFAULTS } from '@shared/outreach'
import type { Campaign, MediaItem } from '@shared/types'
import { LIMITS } from '@shared/media'
import { accountsRepo, campaignsRepo, sendLogRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { broadcast } from '../../events'
import { createLogger } from '../../logger'
import { allowMediaPaths } from '../posting/media'

const log = createLogger('campaigns')

/** Runner tomonidan o'rnatiladi: FLOOD_WAIT dan keyin avtomatik davom etish vaqti. */
export const resumeAtMap = new Map<number, string>()

export function parseSettings(json: string): CampaignSettings {
  try {
    return { ...CAMPAIGN_DEFAULTS, ...(JSON.parse(json) as Partial<CampaignSettings>) }
  } catch {
    return { ...CAMPAIGN_DEFAULTS }
  }
}

export function parseCampaignMedia(json: string | null): MediaItem | null {
  if (!json) return null
  try {
    const v = JSON.parse(json)
    return v && typeof v === 'object' && 'path' in v ? (v as MediaItem) : null
  } catch {
    return null
  }
}

export function toCampaignView(c: Campaign): CampaignView {
  const acc = accountsRepo.getById(c.account_id)
  const media = parseCampaignMedia(c.media_json)
  if (media) allowMediaPaths([media])
  return {
    ...c,
    account_label: acc
      ? acc.first_name || (acc.username ? `@${acc.username}` : acc.phone)
      : `#${c.account_id}`,
    settings: parseSettings(c.settings_json),
    media,
    resumeAt: resumeAtMap.get(c.id) ?? null
  }
}

export function getCampaignView(id: number): CampaignView {
  const c = campaignsRepo.getById(id)
  if (!c) throw new AppError('NOT_FOUND', 'Kampaniya topilmadi.')
  return toCampaignView(c)
}

export function emitCampaign(id: number): CampaignView {
  const v = getCampaignView(id)
  broadcast('campaigns:changed', v)
  return v
}

export function listCampaigns(accountId?: number): CampaignView[] {
  return campaignsRepo.list(accountId).map(toCampaignView)
}

export function campaignReport(id: number): CampaignReport {
  return { campaign: getCampaignView(id), recipients: campaignsRepo.recipients(id) }
}

function validate(input: CampaignInput): void {
  if (!accountsRepo.getById(input.accountId)) throw new AppError('NOT_FOUND', 'Akkaunt topilmadi.')
  const text = input.text.trim()
  if (!text && !input.media)
    throw new AppError('CAMPAIGN_EMPTY', 'Xabar matni yoki media kiriting.')
  const max = input.media ? LIMITS.captionMax : LIMITS.textMax
  if (text.length > max)
    throw new AppError('TEXT_TOO_LONG', `Matn ${max} belgidan oshmasligi kerak.`)
  const s = input.settings
  if (s.delayMin > s.delayMax)
    throw new AppError(
      'CAMPAIGN_SETTINGS',
      "Kechikish: minimal qiymat maksimaldan katta bo'lmasin."
    )
  if (s.groupPauseMin > s.groupPauseMax)
    throw new AppError('CAMPAIGN_SETTINGS', "Pauza: minimal qiymat maksimaldan katta bo'lmasin.")
  if (input.recipients.length > CAMPAIGN_BOUNDS.recipientsMax)
    throw new AppError(
      'CAMPAIGN_SETTINGS',
      `Ko'pi bilan ${CAMPAIGN_BOUNDS.recipientsMax} ta qabul qiluvchi.`
    )
  if (input.scheduledAt) {
    const at = Date.parse(input.scheduledAt)
    if (Number.isNaN(at)) throw new AppError('SCHEDULE_INVALID', "Vaqt noto'g'ri.")
    if ((at - Date.now()) / 1000 < LIMITS.scheduleMinSec)
      throw new AppError('SCHEDULE_TOO_SOON', "Vaqt kamida 1 daqiqa keyin bo'lishi kerak.")
  }
}

export function saveCampaign(input: CampaignInput): CampaignView {
  validate(input)
  const row = {
    name: input.name.trim() || `Kampaniya ${new Date().toLocaleDateString('uz-UZ')}`,
    text: input.text.trim(),
    media_json: input.media ? JSON.stringify(input.media) : null,
    settings_json: JSON.stringify(input.settings),
    scheduled_at: input.scheduledAt
  }
  let id: number
  if (input.id) {
    const existing = campaignsRepo.getById(input.id)
    if (!existing) throw new AppError('NOT_FOUND', 'Kampaniya topilmadi.')
    if (existing.status === 'running')
      throw new AppError(
        'CAMPAIGN_RUNNING',
        "Ishlayotgan kampaniyani tahrirlab bo'lmaydi — avval pauza qiling."
      )
    if (existing.status === 'done' || existing.status === 'cancelled')
      throw new AppError(
        'CAMPAIGN_FINISHED',
        "Tugagan kampaniyani tahrirlab bo'lmaydi. Yangisini yarating."
      )
    campaignsRepo.update(input.id, row)
    id = input.id
    // Yuborilganlar saqlanib qoladi: faqat pending/skipped/failed qayta yoziladi
    const sentPeers = new Set(campaignsRepo.recipients(id, 'sent').map((r) => r.peer_id))
    const keep = campaignsRepo.recipients(id, 'sent')
    campaignsRepo.replaceRecipients(id, [
      ...keep.map((r) => ({ peer_id: r.peer_id, title: r.title, username: r.username })),
      ...input.recipients
        .filter((r) => !sentPeers.has(r.peer))
        .map((r) => ({ peer_id: r.peer, title: r.title, username: r.username }))
    ])
    for (const r of keep) {
      const fresh = campaignsRepo.recipients(id).find((x) => x.peer_id === r.peer_id)
      if (fresh) campaignsRepo.markRecipient(fresh.id, 'sent')
    }
    campaignsRepo.recount(id)
  } else {
    id = campaignsRepo.create({ ...row, account_id: input.accountId }).id
    campaignsRepo.replaceRecipients(
      id,
      input.recipients.map((r) => ({ peer_id: r.peer, title: r.title, username: r.username }))
    )
  }
  campaignsRepo.setStatus(id, input.scheduledAt ? 'scheduled' : 'draft')
  if (input.media) allowMediaPaths([input.media])
  log.info(
    `Kampaniya saqlandi: ${id} (${input.recipients.length} ta qabul qiluvchi${input.scheduledAt ? ', rejali' : ''})`
  )
  return emitCampaign(id)
}

export function deleteCampaign(id: number): void {
  const c = campaignsRepo.getById(id)
  if (!c) return
  if (c.status === 'running')
    throw new AppError(
      'CAMPAIGN_RUNNING',
      "Ishlayotgan kampaniyani o'chirib bo'lmaydi — avval bekor qiling."
    )
  campaignsRepo.remove(id)
  resumeAtMap.delete(id)
  log.info(`Kampaniya o'chirildi: ${id}`)
}

export function accountQuota(accountId: number): { used: number } {
  return { used: sendLogRepo.countLast24h(accountId) }
}
