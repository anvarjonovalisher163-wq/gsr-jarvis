import { MessageSquare } from 'lucide-react'
import Placeholder from '@renderer/components/Placeholder'

export default function ChatsPage() {
  return (
    <Placeholder
      icon={MessageSquare}
      title="Chatlar"
      description="Tanlangan akkauntning dialoglari va xabarlar tarixi shu yerda ko'rinadi."
      step={4}
    />
  )
}
