import { BrowserWindow } from 'electron'
import { handle } from '../../ipc'
import { pickMedia } from './media'
import { deletePost, duplicatePost, getDetail, listPosts, reschedulePost, savePost } from './service'
import { sendPost } from './send'
import { importPostsFromFile } from './importPosts'
import { sendStory } from '../stories/service'

export function registerPostingIpc(): void {
  handle('posts:list', (_e, filter) => listPosts(filter ?? {}))
  handle('posts:get', (_e, { id }) => getDetail(id))
  handle('posts:save', (_e, input) => savePost(input))
  handle('posts:send', (_e, { id }) => sendPost(id))
  handle('posts:retry', (_e, { id }) => sendPost(id, true))
  handle('posts:delete', (_e, { id }) => deletePost(id))
  handle('posts:duplicate', (_e, { id }) => duplicatePost(id))
  handle('posts:reschedule', (_e, { id, scheduledAt }) => reschedulePost(id, scheduledAt))

  handle('media:pick', (e) => pickMedia(BrowserWindow.fromWebContents(e.sender)))
  handle('posts:importFile', (e) => importPostsFromFile(BrowserWindow.fromWebContents(e.sender)))
  handle('stories:send', (_e, input) => sendStory(input))
}
