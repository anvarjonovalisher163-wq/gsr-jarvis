import { handle } from '../../ipc'
import { listTasks, stopTask } from './index'

export function registerTasksIpc(): void {
  handle('tasks:list', () => listTasks())
  handle('tasks:stop', (_e, { key }) => stopTask(key))
}
