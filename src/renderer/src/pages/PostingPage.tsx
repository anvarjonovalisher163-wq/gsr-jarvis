import { Send } from 'lucide-react'
import ChannelList from '@renderer/components/ChannelList'
import Placeholder from '@renderer/components/Placeholder'

export default function PostingPage() {
  return (
    <div className="flex h-full">
      <aside className="w-[300px] shrink-0 border-r border-slate-200 dark:border-slate-800">
        <ChannelList />
      </aside>
      <div className="min-w-0 flex-1">
        <Placeholder
          icon={Send}
          title="Post muharriri"
          description="Chapdan kanallarni tanlang. Matn, media va rejalashtirish shu yerda bo'ladi."
          step={6}
        />
      </div>
    </div>
  )
}
