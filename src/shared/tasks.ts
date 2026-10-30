/** Vazifalar tabi: barcha fon jarayonlari bitta ro'yxatda. */

export type TaskKind = 'post_scheduled' | 'post_sending' | 'broadcast' | 'channel_sync'

export type TaskStatus = 'scheduled' | 'running' | 'paused' | 'failed'

export interface TaskView {
  /** `${kind}:${id}` */
  key: string
  kind: TaskKind
  /** Post id, broadcast id yoki account id */
  id: number
  title: string
  subtitle: string | null
  status: TaskStatus
  /** 0–100 yoki null */
  progress: number | null
  /** ISO: rejali vaqt yoki boshlangan vaqt */
  at: string | null
  /** To'xtatish/bekor qilish mumkinmi */
  stoppable: boolean
}

export interface LogQuery {
  level?: 'debug' | 'info' | 'warn' | 'error'
  module?: string
  search?: string
  limit?: number
}
