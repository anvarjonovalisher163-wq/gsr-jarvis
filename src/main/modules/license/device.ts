import { createHash } from 'crypto'
import { hostname } from 'os'
import { machineIdSync } from 'node-machine-id'
import { settingsRepo } from '../../db/repositories'
import { createLogger } from '../../logger'

const log = createLogger('license')
const KEY = 'license.device_id'

let cached: string | null = null

/**
 * Qurilma identifikatori: node-machine-id (OS darajasidagi ID'ning sha256'i).
 * Olib bo'lmasa — bir marta tasodifiy yaratib bazada saqlaymiz.
 * Natija 64 ta hex belgi (server validDevice bilan mos).
 */
export function deviceId(): string {
  if (cached) return cached
  const saved = settingsRepo.get(KEY)
  if (saved) return (cached = saved)

  let id: string
  try {
    id = machineIdSync(true) // original=true: xom ID, keyin o'zimiz hash qilamiz
    id = createHash('sha256').update(`tgm:${id}`).digest('hex')
  } catch (e) {
    log.warn("machine-id olinmadi, tasodifiy ID ishlatiladi", e)
    id = createHash('sha256').update(`${hostname()}:${Date.now()}:${Math.random()}`).digest('hex')
  }
  settingsRepo.set(KEY, id)
  return (cached = id)
}

export function deviceName(): string {
  return `${hostname()} (${process.platform})`
}
