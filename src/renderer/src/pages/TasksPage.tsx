import { ListChecks } from 'lucide-react'
import Placeholder from '@renderer/components/Placeholder'

export default function TasksPage() {
  return (
    <Placeholder
      icon={ListChecks}
      title="Vazifalar"
      description="Fon jarayonlari: rejali postlar, rassilkalar, sinxronlash va loglar."
      step={11}
    />
  )
}
