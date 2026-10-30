import { Bot } from 'lucide-react'
import Placeholder from '@renderer/components/Placeholder'

export default function BotsPage() {
  return (
    <Placeholder
      icon={Bot}
      title="Botlar"
      description="Telegram botlarni ulash, avto-javob qoidalari va obunachilarga rassilka."
      step={8}
    />
  )
}
