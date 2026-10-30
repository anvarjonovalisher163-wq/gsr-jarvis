import { Users } from 'lucide-react'
import Placeholder from '@renderer/components/Placeholder'

export default function ContactsPage() {
  return (
    <Placeholder
      icon={Users}
      title="Kontaktlar"
      description="Chatlar va obunachilar uchun teglar (CRM), kontakt kartalari va statistika."
      step={10}
    />
  )
}
