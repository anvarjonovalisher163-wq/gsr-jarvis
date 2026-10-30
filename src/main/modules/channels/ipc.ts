import { handle } from '../../ipc'
import { listChannelViews, syncChannels } from './sync'

export function registerChannelsIpc(): void {
  handle('channels:sync', (_e, { accountId }) => syncChannels(accountId))
  handle('channels:list', (_e, { accountId }) => listChannelViews(accountId))
}
