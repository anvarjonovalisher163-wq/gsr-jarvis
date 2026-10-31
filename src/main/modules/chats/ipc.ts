import { BrowserWindow } from 'electron'
import { handle } from '../../ipc'
import { downloadMessageFile, getDialogs, getMessages, markRead, messageThumb, peerAvatar, sendMessage, resolvePeer } from './service'

export function registerChatsIpc(): void {
  handle('chats:dialogs', (_e, { accountId, offsetDate }) => getDialogs(accountId, offsetDate))
  handle('chats:messages', (_e, { accountId, peer, offsetId }) => getMessages(accountId, peer, offsetId))
  handle('chats:send', (_e, { accountId, peer, text, filePath }) => sendMessage(accountId, peer, text, filePath))
  handle('chats:markRead', (_e, { accountId, peer }) => markRead(accountId, peer))
  handle('chats:avatar', (_e, { accountId, peer }) => peerAvatar(accountId, peer))
  handle('chats:thumb', (_e, { accountId, peer, msgId }) => messageThumb(accountId, peer, msgId))
  handle('chats:resolve', (_e, { accountId, query }) => resolvePeer(accountId, query))
  handle('chats:download', (e, { accountId, peer, msgId }) => downloadMessageFile(accountId, peer, msgId, BrowserWindow.fromWebContents(e.sender)))
}
