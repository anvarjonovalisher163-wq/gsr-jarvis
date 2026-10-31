import type { LucideIcon } from 'lucide-react'
import { MessageSquare, Send, Bot, Users, Megaphone, ListChecks, Settings } from 'lucide-react'

export interface TabDef {
  path: string
  label: string
  icon: LucideIcon
}

export const TABS: TabDef[] = [
  { path: '/chats', label: 'Chatlar', icon: MessageSquare },
  { path: '/posting', label: 'Posting', icon: Send },
  { path: '/bots', label: 'Botlar', icon: Bot },
  { path: '/outreach', label: 'Xabarnoma', icon: Megaphone },
  { path: '/contacts', label: 'Kontaktlar', icon: Users },
  { path: '/tasks', label: 'Vazifalar', icon: ListChecks },
  { path: '/settings', label: 'Sozlamalar', icon: Settings }
]
