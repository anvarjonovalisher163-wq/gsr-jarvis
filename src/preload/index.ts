import { contextBridge, ipcRenderer } from 'electron'
import type { BridgeApi, IpcChannel, IpcReq, IpcRes, IpcEvent, IpcEventPayload } from '@shared/ipc'
import type { IpcEnvelope } from '@shared/errors'

/**
 * Envelope'ni o'zgartirmasdan qaytaradi. Bridge Error'larning code maydonini
 * yo'qotgani uchun ochish renderer'da (@renderer/lib/api) bajariladi.
 */
function invoke<C extends IpcChannel>(channel: C, req?: IpcReq<C>): Promise<IpcEnvelope<IpcRes<C>>> {
  return ipcRenderer.invoke(channel, req)
}

const api: BridgeApi = {
  chats: {
    dialogs: (accountId, offsetDate) => invoke('chats:dialogs', { accountId, offsetDate }),
    messages: (accountId, peer, offsetId) => invoke('chats:messages', { accountId, peer, offsetId }),
    send: (accountId, peer, text, filePath) => invoke('chats:send', { accountId, peer, text, filePath }),
    markRead: (accountId, peer) => invoke('chats:markRead', { accountId, peer }),
    avatar: (accountId, peer) => invoke('chats:avatar', { accountId, peer }),
    thumb: (accountId, peer, msgId) => invoke('chats:thumb', { accountId, peer, msgId }),
    download: (accountId, peer, msgId) => invoke('chats:download', { accountId, peer, msgId })
  },
  tags: {
    list: () => invoke('tags:list'),
    create: (name, color) => invoke('tags:create', { name, color }),
    update: (id, patch) => invoke('tags:update', { id, ...patch }),
    delete: (id) => invoke('tags:delete', { id })
  },
  contacts: {
    get: (accountId, peer) => invoke('contacts:get', { accountId, peer }),
    setTags: (p) => invoke('contacts:setTags', p),
    setNote: (p) => invoke('contacts:setNote', p),
    tagMap: (accountId) => invoke('contacts:tagMap', { accountId }),
    list: (f) => invoke('contacts:list', f ?? {})
  },
  stats: {
    overview: (days) => invoke('stats:overview', { days }),
    channelViews: () => invoke('stats:channelViews')
  },
  app: {
    getVersion: () => invoke('app:getVersion'),
    getSettings: () => invoke('app:getSettings'),
    setSettings: (patch) => invoke('app:setSettings', patch)
  },
  tasks: {
    list: () => invoke('tasks:list'),
    stop: (key) => invoke('tasks:stop', { key })
  },
  logs: {
    list: (q) => invoke('logs:list', q ?? {}),
    modules: () => invoke('logs:modules'),
    export: (q) => invoke('logs:export', q ?? {}),
    clear: () => invoke('logs:clear')
  },
  backup: {
    export: () => invoke('backup:export'),
    import: () => invoke('backup:import')
  },
  settings: {
    get: (keys) => invoke('settings:get', { keys }),
    set: (values) => invoke('settings:set', { values })
  },
  accounts: {
    list: () => invoke('accounts:list'),
    sendCode: (phone) => invoke('accounts:sendCode', { phone }),
    signIn: (code) => invoke('accounts:signIn', { code }),
    check2FA: (password) => invoke('accounts:check2FA', { password }),
    cancelLogin: () => invoke('accounts:cancelLogin'),
    logout: (id) => invoke('accounts:logout', { id }),
    remove: (id) => invoke('accounts:remove', { id }),
    importSessions: (sessions) => invoke('accounts:importSessions', { sessions }),
    importFiles: () => invoke('accounts:importFiles'),
    exportSessions: (ids) => invoke('accounts:exportSessions', { ids }),
    spamCheck: (id) => invoke('accounts:spamCheck', { id })
  },
  channels: {
    sync: (accountId) => invoke('channels:sync', { accountId }),
    list: (accountId) => invoke('channels:list', { accountId })
  },
  posts: {
    list: (filter) => invoke('posts:list', filter ?? {}),
    get: (id) => invoke('posts:get', { id }),
    save: (input) => invoke('posts:save', input),
    send: (id) => invoke('posts:send', { id }),
    retry: (id) => invoke('posts:retry', { id }),
    delete: (id) => invoke('posts:delete', { id }),
    duplicate: (id) => invoke('posts:duplicate', { id }),
    reschedule: (id, scheduledAt) => invoke('posts:reschedule', { id, scheduledAt })
  },
  media: {
    pick: () => invoke('media:pick')
  },
  bots: {
    list: () => invoke('bots:list'),
    add: (token) => invoke('bots:add', { token }),
    start: (id) => invoke('bots:start', { id }),
    stop: (id) => invoke('bots:stop', { id }),
    remove: (id) => invoke('bots:remove', { id })
  },
  botRules: {
    list: (botId) => invoke('botRules:list', { botId }),
    save: (input) => invoke('botRules:save', input),
    delete: (id) => invoke('botRules:delete', { id }),
    toggle: (id, active) => invoke('botRules:toggle', { id, active })
  },
  subscribers: {
    list: (q) => invoke('subscribers:list', q),
    tags: (botId) => invoke('subscribers:tags', { botId }),
    exportCsv: (botId) => invoke('subscribers:exportCsv', { botId }),
    count: (botId, tag) => invoke('subscribers:count', { botId, tag }),
    setTags: (id, tags) => invoke('subscribers:setTags', { id, tags })
  },
  broadcasts: {
    list: (botId) => invoke('broadcasts:list', { botId }),
    create: (input) => invoke('broadcasts:create', input),
    pause: (id) => invoke('broadcasts:pause', { id }),
    resume: (id) => invoke('broadcasts:resume', { id }),
    cancel: (id) => invoke('broadcasts:cancel', { id }),
    delete: (id) => invoke('broadcasts:delete', { id }),
    report: (id) => invoke('broadcasts:report', { id })
  },
  license: {
    status: () => invoke('license:status'),
    startTrial: (email) => invoke('license:startTrial', { email }),
    activate: (key) => invoke('license:activate', { key }),
    check: () => invoke('license:check'),
    deactivate: () => invoke('license:deactivate')
  },
  updater: {
    status: () => invoke('updater:status'),
    check: () => invoke('updater:check'),
    download: () => invoke('updater:download'),
    install: () => invoke('updater:install')
  },
  on: <E extends IpcEvent>(event: E, cb: (payload: IpcEventPayload<E>) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: IpcEventPayload<E>) => cb(payload)
    ipcRenderer.on(event, listener)
    return () => ipcRenderer.removeListener(event, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('platform', process.platform)
