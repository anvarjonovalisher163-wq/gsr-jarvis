import { z } from 'zod'
import type { IpcChannel, IpcReq } from '@shared/ipc'
import { CAMPAIGN_BOUNDS } from '@shared/outreach'

/**
 * Har bir IPC kanali uchun kirish sxemasi. Renderer (yoki unga kirib olgan kod) yuborgan
 * ma'lumot handler'ga yetguncha shu yerda tekshiriladi. Tip darajasida har kanal uchun sxema
 * BO'LISHI SHART — yangi kanal qo'shilsa, bu yerga yozilmaguncha kompilyatsiya o'tmaydi.
 */

const id = z.number().int().positive()
const optionalId = id.optional()
const shortText = (max: number) => z.string().max(max)
const isoDate = z.string().max(40)

const mediaItem = z.object({
  path: z.string().min(1).max(4096),
  kind: z.enum(['photo', 'video', 'document']),
  caption: z.string().max(1024).optional()
})

const urlButton = z.object({ text: shortText(64), url: shortText(2048) })
const buttonRows = z.array(z.array(urlButton).max(8)).max(20)

const postStatus = z.enum(['draft', 'scheduled', 'sent', 'failed'])
const peerKey = z.string().regex(/^(u|c|ch)\d{1,20}$/)
const logQuery = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  module: shortText(64).optional(),
  search: shortText(200).optional(),
  limit: z.number().int().min(1).max(5000).optional()
})

export const ipcSchemas = {
  'app:getVersion': z.void(),

  'settings:get': z.object({ keys: z.array(shortText(64)).max(50) }),
  'settings:set': z.object({ values: z.record(shortText(64), shortText(4096)) }),

  'accounts:list': z.void(),
  'accounts:sendCode': z.object({ phone: shortText(32) }),
  'accounts:signIn': z.object({ code: shortText(16) }),
  'accounts:check2FA': z.object({ password: shortText(512) }),
  'accounts:cancelLogin': z.void(),
  'accounts:logout': z.object({ id }),
  'accounts:remove': z.object({ id }),
  'accounts:importSessions': z.object({
    sessions: z.array(z.string().min(1).max(2000)).min(1).max(50)
  }),
  'accounts:importFiles': z.void(),
  'accounts:exportSessions': z.object({ ids: z.array(id).min(1).max(200) }),
  'accounts:spamCheck': z.object({ id }),

  'channels:sync': z.object({ accountId: id }),
  'channels:list': z.object({ accountId: optionalId }),

  'posts:list': z.object({
    status: postStatus.optional(),
    channelId: optionalId,
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.number().int().min(1).max(1000).optional()
  }),
  'posts:get': z.object({ id }),
  'posts:save': z.object({
    id: optionalId,
    title: shortText(200),
    text: shortText(20_000),
    media: z.array(mediaItem).max(10),
    channelIds: z.array(id).max(500),
    scheduledAt: isoDate.nullable()
  }),
  'posts:send': z.object({ id }),
  'posts:retry': z.object({ id }),
  'posts:delete': z.object({ id }),
  'posts:duplicate': z.object({ id }),
  'posts:reschedule': z.object({ id, scheduledAt: isoDate }),

  'media:pick': z.void(),

  'bots:list': z.void(),
  'bots:add': z.object({ token: shortText(200) }),
  'bots:start': z.object({ id }),
  'bots:stop': z.object({ id }),
  'bots:remove': z.object({ id }),

  'botRules:list': z.object({ botId: id }),
  'botRules:save': z.object({
    id: optionalId,
    bot_id: id,
    trigger_type: z.enum(['command', 'keyword', 'any']),
    trigger_value: shortText(200).nullable(),
    reply_text: shortText(8192),
    reply_media: mediaItem.nullable(),
    reply_buttons: buttonRows,
    is_active: z.boolean()
  }),
  'botRules:delete': z.object({ id }),
  'botRules:toggle': z.object({ id, active: z.boolean() }),

  'subscribers:list': z.object({
    botId: id,
    search: shortText(100).optional(),
    tag: shortText(64).optional(),
    activeOnly: z.boolean().optional()
  }),
  'subscribers:tags': z.object({ botId: id }),
  'subscribers:exportCsv': z.object({ botId: id }),
  'subscribers:count': z.object({ botId: id, tag: shortText(64).nullable().optional() }),

  'broadcasts:list': z.object({ botId: optionalId }),
  'broadcasts:create': z.object({
    bot_id: id,
    text: shortText(8192),
    media: mediaItem.nullable(),
    buttons: buttonRows,
    tag_filter: shortText(64).nullable(),
    scheduledAt: isoDate.nullable()
  }),
  'broadcasts:pause': z.object({ id }),
  'broadcasts:resume': z.object({ id }),
  'broadcasts:cancel': z.object({ id }),
  'broadcasts:delete': z.object({ id }),
  'broadcasts:report': z.object({ id }),

  'license:status': z.void(),
  'license:startTrial': z.object({ email: shortText(200) }),
  'license:activate': z.object({ key: shortText(64) }),
  'license:check': z.void(),
  'license:deactivate': z.void(),

  'updater:status': z.void(),
  'updater:check': z.void(),
  'updater:download': z.void(),
  'updater:install': z.void(),

  'tasks:list': z.void(),
  'tasks:stop': z.object({ key: shortText(64) }),

  'logs:list': logQuery,
  'logs:modules': z.void(),
  'logs:export': logQuery,
  'logs:clear': z.void(),

  'backup:export': z.void(),
  'backup:import': z.void(),

  'chats:dialogs': z.object({
    accountId: id,
    offsetDate: z.number().int().nonnegative().optional()
  }),
  'chats:messages': z.object({
    accountId: id,
    peer: peerKey,
    offsetId: z.number().int().nonnegative().optional()
  }),
  'chats:send': z.object({
    accountId: id,
    peer: peerKey,
    text: shortText(4096),
    filePath: z.string().min(1).max(4096).optional()
  }),
  'chats:markRead': z.object({ accountId: id, peer: peerKey }),
  'chats:avatar': z.object({ accountId: id, peer: peerKey }),
  'chats:thumb': z.object({ accountId: id, peer: peerKey, msgId: id }),
  'chats:download': z.object({ accountId: id, peer: peerKey, msgId: id }),

  'tags:list': z.void(),
  'tags:create': z.object({
    name: shortText(40).min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
  }),
  'tags:update': z.object({
    id,
    name: shortText(40).min(1).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
  }),
  'tags:delete': z.object({ id }),
  'contacts:get': z.object({ accountId: id, peer: peerKey }),
  'contacts:setTags': z.object({
    accountId: id,
    peer: peerKey,
    title: shortText(200),
    username: shortText(64).nullable(),
    kind: shortText(16),
    tagIds: z.array(id).max(50)
  }),
  'contacts:setNote': z.object({
    accountId: id,
    peer: peerKey,
    title: shortText(200),
    username: shortText(64).nullable(),
    kind: shortText(16),
    note: shortText(4000)
  }),
  'contacts:tagMap': z.object({ accountId: id }),
  'contacts:list': z.object({
    accountId: optionalId,
    tagId: optionalId,
    search: shortText(100).optional()
  }),
  'subscribers:setTags': z.object({ id, tags: z.array(shortText(32)).max(30) }),
  'stats:overview': z.object({ days: z.number().int().min(7).max(365) }),
  'stats:channelViews': z.void(),

  'app:getSettings': z.void(),
  'app:setSettings': z.object({
    autoStart: z.boolean().optional(),
    closeToTray: z.boolean().optional(),
    language: z.enum(['uz', 'ru', 'en']).optional(),
    proxy: z
      .object({
        type: z.enum(['none', 'socks5', 'http']),
        host: shortText(253),
        port: z.number().int().min(1).max(65535),
        username: shortText(200),
        password: shortText(200)
      })
      .optional()
  }),

  'templates:list': z.void(),
  'templates:save': z.object({
    id: optionalId,
    name: shortText(100).min(1),
    text: shortText(8192),
    media: mediaItem.nullable(),
    buttons: buttonRows
  }),
  'templates:delete': z.object({ id }),

  'blacklist:list': z.object({ search: shortText(100).optional() }),
  'blacklist:add': z.object({
    tgUserId: z.string().regex(/^u?\d{1,20}$/),
    username: shortText(64).nullable(),
    title: shortText(200),
    reason: shortText(500)
  }),
  'blacklist:remove': z.object({ id }),

  'campaigns:list': z.object({ accountId: optionalId }),
  'campaigns:get': z.object({ id }),
  'campaigns:save': z.object({
    id: optionalId,
    name: shortText(200),
    accountId: id,
    text: shortText(4096),
    media: mediaItem.nullable(),
    settings: z.object({
      delayMin: z.number().int().min(CAMPAIGN_BOUNDS.delayMinFloor).max(CAMPAIGN_BOUNDS.delayMax),
      delayMax: z.number().int().min(CAMPAIGN_BOUNDS.delayMinFloor).max(CAMPAIGN_BOUNDS.delayMax),
      groupSize: z.number().int().min(1).max(CAMPAIGN_BOUNDS.groupSizeMax),
      groupPauseMin: z.number().int().min(0).max(CAMPAIGN_BOUNDS.groupPauseMax),
      groupPauseMax: z.number().int().min(0).max(CAMPAIGN_BOUNDS.groupPauseMax),
      onlyNew: z.boolean(),
      dailyLimit: z.number().int().min(1).max(CAMPAIGN_BOUNDS.dailyLimitMax)
    }),
    recipients: z
      .array(
        z.object({
          peer: z.string().regex(/^u\d{1,20}$/),
          title: shortText(200),
          username: shortText(64).nullable()
        })
      )
      .max(CAMPAIGN_BOUNDS.recipientsMax),
    scheduledAt: isoDate.nullable()
  }),
  'campaigns:start': z.object({ id }),
  'campaigns:pause': z.object({ id }),
  'campaigns:resume': z.object({ id }),
  'campaigns:cancel': z.object({ id }),
  'campaigns:delete': z.object({ id }),
  'campaigns:quota': z.object({ accountId: id }),

  'apiServer:status': z.void(),
  'apiServer:configure': z.object({
    enabled: z.boolean().optional(),
    port: z.number().int().min(1024).max(65535).optional(),
    dailyLimit: z.number().int().min(1).max(CAMPAIGN_BOUNDS.dailyLimitMax).optional()
  }),
  'apiServer:regenerateKey': z.void(),

  'profile:get': z.void(),
  'profile:set': z.object({ name: shortText(100), email: shortText(200), phone: shortText(32) })
} satisfies { [C in IpcChannel]: z.ZodType<IpcReq<C>, z.ZodTypeDef, unknown> }

export type IpcSchemas = typeof ipcSchemas
