import { BrowserWindow } from 'electron'
import { handle } from '../../ipc'
import { botRulesRepo, botSubscribersRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { botManager } from './botManager'
import { addBot, emitBotsChanged, exportSubscribersCsv, listBotViews, listRules, removeBot, saveRule, toBotView } from './service'
import { botsRepo } from '../../db/repositories'
import {
  broadcastReport,
  cancelBroadcast,
  createBroadcast,
  deleteBroadcast,
  listBroadcasts,
  pauseBroadcast,
  resumeBroadcast
} from './broadcast'

export function registerBotsIpc(): void {
  botManager.setOnChange(emitBotsChanged)

  handle('bots:list', () => listBotViews())
  handle('bots:add', (_e, { token }) => addBot(token))
  handle('bots:start', async (_e, { id }) => {
    await botManager.start(id)
    const bot = botsRepo.getById(id)
    if (!bot) throw new AppError('NOT_FOUND', 'Bot topilmadi.')
    return toBotView(bot)
  })
  handle('bots:stop', async (_e, { id }) => {
    await botManager.stop(id)
    const bot = botsRepo.getById(id)
    if (!bot) throw new AppError('NOT_FOUND', 'Bot topilmadi.')
    return toBotView(bot)
  })
  handle('bots:remove', (_e, { id }) => removeBot(id))

  handle('botRules:list', (_e, { botId }) => listRules(botId))
  handle('botRules:save', (_e, input) => saveRule(input))
  handle('botRules:delete', (_e, { id }) => botRulesRepo.remove(id))
  handle('botRules:toggle', (_e, { id, active }) => {
    botRulesRepo.setActive(id, active)
    const rule = botRulesRepo.getById(id)
    if (!rule) throw new AppError('NOT_FOUND', 'Qoida topilmadi.')
    return rule
  })

  handle('subscribers:list', (_e, q) =>
    botSubscribersRepo.list(q.botId, { search: q.search, tag: q.tag, activeOnly: q.activeOnly, limit: 2000 })
  )
  handle('subscribers:tags', (_e, { botId }) => botSubscribersRepo.distinctTags(botId))
  handle('subscribers:exportCsv', (e, { botId }) => exportSubscribersCsv(botId, BrowserWindow.fromWebContents(e.sender)))
  handle('subscribers:count', (_e, { botId, tag }) => botSubscribersRepo.listActiveForBroadcast(botId, tag).length)

  handle('broadcasts:list', (_e, { botId }) => listBroadcasts(botId))
  handle('broadcasts:create', (_e, input) => createBroadcast(input))
  handle('broadcasts:pause', (_e, { id }) => pauseBroadcast(id))
  handle('broadcasts:resume', (_e, { id }) => resumeBroadcast(id))
  handle('broadcasts:cancel', (_e, { id }) => cancelBroadcast(id))
  handle('broadcasts:delete', (_e, { id }) => deleteBroadcast(id))
  handle('broadcasts:report', (_e, { id }) => broadcastReport(id))
}
