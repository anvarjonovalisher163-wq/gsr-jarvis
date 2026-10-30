import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { initAccountsSync } from '@renderer/store/accounts'
import { initPostsSync } from '@renderer/store/posts'
import { initBotsSync } from '@renderer/store/bots'
import Sidebar from '@renderer/components/Sidebar'
import TopTabs from '@renderer/components/TopTabs'
import ChatsPage from '@renderer/pages/ChatsPage'
import PostingPage from '@renderer/pages/PostingPage'
import BotsPage from '@renderer/pages/BotsPage'
import ContactsPage from '@renderer/pages/ContactsPage'
import TasksPage from '@renderer/pages/TasksPage'
import SettingsPage from '@renderer/pages/SettingsPage'

export default function App() {
  useEffect(() => initAccountsSync(), [])
  useEffect(() => initPostsSync(), [])
  useEffect(() => initBotsSync(), [])

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopTabs />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/chats" replace />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/posting" element={<PostingPage />} />
            <Route path="/bots" element={<BotsPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/chats" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
