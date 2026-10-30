import { useState } from 'react'
import { ListChecks, ScrollText } from 'lucide-react'
import TasksList from '@renderer/components/tasks/TasksList'
import LogsPanel from '@renderer/components/tasks/LogsPanel'

type Tab = 'tasks' | 'logs'

export default function TasksPage() {
  const [tab, setTab] = useState<Tab>('tasks')
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <TabBtn active={tab === 'tasks'} icon={ListChecks} onClick={() => setTab('tasks')}>
          Vazifalar
        </TabBtn>
        <TabBtn active={tab === 'logs'} icon={ScrollText} onClick={() => setTab('logs')}>
          Loglar
        </TabBtn>
      </div>
      <div className="min-h-0 flex-1">{tab === 'tasks' ? <TasksList /> : <LogsPanel />}</div>
    </div>
  )
}

function TabBtn({ active, icon: Icon, onClick, children }: { active: boolean; icon: typeof ListChecks; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
        active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
      ].join(' ')}
    >
      <Icon size={15} />
      {children}
    </button>
  )
}
