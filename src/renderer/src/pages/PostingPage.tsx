import { Send } from 'lucide-react'
import Placeholder from '@renderer/components/Placeholder'

export default function PostingPage() {
  return (
    <Placeholder
      icon={Send}
      title="Posting"
      description="Kanal va guruhlaringizga hozir yoki rejali post joylash, kontent kalendar."
      step={6}
    />
  )
}
