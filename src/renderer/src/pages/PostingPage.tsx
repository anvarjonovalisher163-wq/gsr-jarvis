import { useEffect } from 'react'
import { List, PenSquare } from 'lucide-react'
import ChannelList from '@renderer/components/ChannelList'
import PostEditor from '@renderer/components/posting/PostEditor'
import PostList from '@renderer/components/posting/PostList'
import { usePosts } from '@renderer/store/posts'

export default function PostingPage() {
  const { view, setView, editing, openNew, openEdit, load, posts } = usePosts()

  useEffect(() => {
    load().catch(console.error)
  }, [load])

  return (
    <div className="flex h-full">
      <aside className="w-[300px] shrink-0 border-r border-slate-200 dark:border-slate-800">
        <ChannelList />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <ViewTab active={view === 'editor'} icon={PenSquare} onClick={() => (editing ? setView('editor') : openNew())}>
            {editing ? `Tahrirlash #${editing.post.id}` : 'Yangi post'}
          </ViewTab>
          <ViewTab active={view === 'list'} icon={List} onClick={() => setView('list')}>
            Postlar{posts.length > 0 && <span className="ml-1 text-xs opacity-70">({posts.length})</span>}
          </ViewTab>
          {editing && (
            <button type="button" onClick={openNew} className="ml-auto text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
              + Yangi post
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1">
          {view === 'editor' ? (
            <PostEditor editing={editing} onDone={() => setView('list')} />
          ) : (
            <PostList onEdit={openEdit} />
          )}
        </div>
      </div>
    </div>
  )
}

function ViewTab({
  active,
  icon: Icon,
  onClick,
  children
}: {
  active: boolean
  icon: typeof List
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
        active
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
      ].join(' ')}
    >
      <Icon size={15} />
      {children}
    </button>
  )
}
