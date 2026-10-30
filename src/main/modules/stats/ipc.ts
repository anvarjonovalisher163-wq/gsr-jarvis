import { handle } from '../../ipc'
import { channelViews, overview } from './service'

export function registerStatsIpc(): void {
  handle('stats:overview', (_e, { days }) => overview(days))
  handle('stats:channelViews', () => channelViews())
}
