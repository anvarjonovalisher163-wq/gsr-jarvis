import { useEffect, useState } from 'react'
import { CalendarDays, CircleDashed, FileUp, List, PenSquare } from 'lucide-react'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import StoryPanel from '@renderer/components/posting/StoryPanel'
import ChannelList from '@renderer/components/ChannelList'
import PostEditor from '@renderer/components/posting/PostEditor'
import PostList from '@renderer/components/posting/PostList'
import Calendar from '@renderer/components/posting/Calendar'
import { usePosts } from '@renderer/store/posts'

export default function PostingPage() {
  const { view, setView, editing, openNew, openEdit, load, posts } = usePosts()
  const [notice, setNotice] = useState<string | null>(null)

  const importPosts = async () => {
    try {
      const r = await api.posts.importFile()
      if (r.count > 0) {
        await load()
        setView('list')
        setNotice(`${r.count} ta post qoralama sifatida qo'shildi.`)
      }
    } catch (e) {
      setNotice(describeError(e).message)
    }
    setTimeout(() => setNotice(null), 5000)
  }

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
          <ViewTab active={view === 'calendar'} icon={CalendarDays} onClick={() => setView('calendar')}>
            Kalendar
          </ViewTab>
          <ViewTab active={view === 'stories'} icon={CircleDashed} onClick={() => setView('stories')}>
            Stories
          </ViewTab>
          <span className="ml-auto flex items-center gap-3">
            {notice && <span className="text-xs text-slate-500">{notice}</span>}
            <button type="button" onClick={importPosts} title="Postlarni .txt/.json/.csv fayldan import qilish" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
              <FileUp size={13} /> Import
            </button>
            {editing && (
              <button type="button" onClick={() => openNew()} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
                + Yangi post
              </button>
            )}
          </span>
        </div>

        <div className="min-h-0 flex-1">
          {view === 'editor' ? (
            <PostEditor editing={editing} onDone={() => setView('list')} />
          ) : view === 'list' ? (
            <PostList onEdit={openEdit} />
          ) : view === 'stories' ? (
            <StoryPanel />
          ) : (
            <Calendar onEdit={openEdit} onNew={(iso) => openNew(iso)} />
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
