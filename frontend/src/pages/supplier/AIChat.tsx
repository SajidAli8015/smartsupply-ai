import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Database,
  Loader2,
  MessageSquare,
  Package,
  Plus,
  Send,
  ShoppingCart,
  Sparkles,
  Table,
  Trash2,
} from 'lucide-react'
import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  getSessions as apiGetSessions,
  getSessionMessages,
  sendMessage as apiSendMessage,
} from '../../api/ai'
import type { ChatSession } from '../../api/ai'
import { getKPIs, getLowStock } from '../../api/analytics'
import { timeAgo } from '../../lib/format'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sql_query?: string | null
  data?: Record<string, unknown>[] | null
  created_at: string
  isLoading?: boolean
  isError?: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'Which products should I reorder this week?',
  'What was my revenue this month?',
  'Which orders are still unshipped?',
  'Who are my top buying customers?',
  'Which factory has the fastest delivery time?',
  "What's my current inventory value?",
]

const QUICK_ACTIONS = [
  {
    label: 'Analyze slow movers',
    message: 'Which products are slow movers this month and should I consider discounting?',
  },
  {
    label: 'Reorder suggestions',
    message: 'Which products should I reorder based on current inventory levels and low-stock alerts?',
  },
  {
    label: 'Revenue summary',
    message: 'Give me a revenue summary for this month including top-performing products.',
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="block h-2 w-2 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

function SqlPanel({
  sql,
  expanded,
  onToggle,
}: {
  sql: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 text-xs">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 bg-slate-50 px-3 py-2 text-left text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <Database size={12} />
        <span className="font-medium">View SQL Query</span>
        {expanded ? (
          <ChevronUp size={12} className="ml-auto" />
        ) : (
          <ChevronDown size={12} className="ml-auto" />
        )}
      </button>
      {expanded && (
        <pre className="overflow-x-auto bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-green-400">
          {sql}
        </pre>
      )}
    </div>
  )
}

function DataPanel({
  data,
  expanded,
  onToggle,
}: {
  data: Record<string, unknown>[]
  expanded: boolean
  onToggle: () => void
}) {
  if (!data.length) return null
  const columns = Object.keys(data[0])
  const rows = data.slice(0, 10)
  const overflow = data.length - 10

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 text-xs">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 bg-slate-50 px-3 py-2 text-left text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <Table size={12} />
        <span className="font-medium">View Raw Data</span>
        <span className="ml-1 text-slate-400">
          ({data.length} row{data.length !== 1 ? 's' : ''})
        </span>
        {expanded ? (
          <ChevronUp size={12} className="ml-auto" />
        ) : (
          <ChevronDown size={12} className="ml-auto" />
        )}
      </button>
      {expanded && (
        <div className="max-h-52 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="max-w-[180px] truncate whitespace-nowrap px-3 py-1.5 text-slate-700"
                    >
                      {row[col] === null || row[col] === undefined
                        ? '—'
                        : typeof row[col] === 'object'
                          ? JSON.stringify(row[col])
                          : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {overflow > 0 && (
            <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-slate-400">
              … and {overflow} more row{overflow !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function MessageBubble({
  msg,
  sqlExpanded,
  dataExpanded,
  onToggleSql,
  onToggleData,
}: {
  msg: LocalMessage
  sqlExpanded: boolean
  dataExpanded: boolean
  onToggleSql: () => void
  onToggleData: () => void
}) {
  if (msg.isLoading) {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
          <Sparkles size={14} className="text-indigo-600" />
        </div>
        <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <TypingDots />
        </div>
      </div>
    )
  }

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%]">
          <div className="rounded-2xl rounded-tr-sm bg-slate-800 px-4 py-3 text-sm leading-relaxed text-white">
            {msg.content}
          </div>
          <p className="mt-1 pr-1 text-right text-[11px] text-slate-400">
            {timeAgo(msg.created_at)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
        <Sparkles size={14} className="text-indigo-600" />
      </div>
      <div className="min-w-0 max-w-[85%] flex-1">
        <div
          className={`rounded-2xl rounded-tl-sm border px-4 py-3 text-sm shadow-sm ${
            msg.isError
              ? 'border-red-200 bg-red-50'
              : 'border-slate-200 bg-white'
          }`}
        >
          {msg.isError && (
            <div className="mb-1.5 flex items-center gap-1.5">
              <AlertCircle size={13} className="text-red-500" />
              <span className="text-xs font-medium text-red-600">Something went wrong</span>
            </div>
          )}
          <p
            className={`whitespace-pre-wrap leading-relaxed ${
              msg.isError ? 'text-red-700' : 'text-slate-800'
            }`}
          >
            {msg.content}
          </p>
        </div>
        {msg.sql_query && (
          <SqlPanel sql={msg.sql_query} expanded={sqlExpanded} onToggle={onToggleSql} />
        )}
        {msg.data && msg.data.length > 0 && (
          <DataPanel data={msg.data} expanded={dataExpanded} onToggle={onToggleData} />
        )}
        <p className="mt-1 pl-1 text-[11px] text-slate-400">{timeAgo(msg.created_at)}</p>
      </div>
    </div>
  )
}

function SnapshotStat({
  label,
  value,
  icon,
  warn = false,
}: {
  label: string
  value: number | undefined
  icon: ReactNode
  warn?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-4">
      {icon}
      <span className={`text-lg font-bold ${warn ? 'text-amber-600' : 'text-slate-800'}`}>
        {value ?? '—'}
      </span>
      <span className="text-center text-[10px] leading-tight text-slate-400">{label}</span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AIChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [expandedSql, setExpandedSql] = useState<Set<string>>(new Set())
  const [expandedData, setExpandedData] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data: kpis } = useQuery({
    queryKey: ['kpis', 'today'],
    queryFn: () => getKPIs('today'),
    staleTime: 60_000,
  })
  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: getLowStock,
    staleTime: 60_000,
  })

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    void loadSessions()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function loadSessions() {
    try {
      const data = await apiGetSessions()
      setSessions(data)
      if (data.length > 0) {
        await openSession(data[0].id)
      }
    } finally {
      setSessionsLoaded(true)
    }
  }

  async function openSession(sessionId: number) {
    setActiveSessionId(sessionId)
    setExpandedSql(new Set())
    setExpandedData(new Set())
    try {
      const msgs = await getSessionMessages(sessionId)
      setMessages(
        msgs.map((m) => ({
          id: String(m.id),
          role: m.role,
          content: m.content,
          sql_query: m.sql_query,
          created_at: m.created_at,
        })),
      )
    } catch {
      setMessages([])
    }
  }

  function startNewChat() {
    setActiveSessionId(null)
    setMessages([])
    setInput('')
    setExpandedSql(new Set())
    setExpandedData(new Set())
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || isSending) return
    setInput('')

    let sessionId = activeSessionId

    if (sessionId === null) {
      try {
        const session = await apiCreateSession(msg)
        sessionId = session.id
        setActiveSessionId(session.id)
        setSessions((prev) => [session, ...prev])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'Failed to start a new session. Please try again.',
            created_at: new Date().toISOString(),
            isError: true,
          },
        ])
        return
      }
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `opt-user-${Date.now()}`,
        role: 'user',
        content: msg,
        created_at: new Date().toISOString(),
      },
      {
        id: 'opt-loading',
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        isLoading: true,
      },
    ])
    setIsSending(true)

    try {
      const response = await apiSendMessage(sessionId, msg)
      const responseId = `resp-${Date.now()}`
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== 'opt-loading'),
        {
          id: responseId,
          role: 'assistant',
          content: response.response,
          sql_query: response.sql_query,
          data: response.data,
          created_at: new Date().toISOString(),
        },
      ])
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, updated_at: new Date().toISOString() } : s,
        ),
      )
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== 'opt-loading'),
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: detail ?? 'I encountered an error processing your request. Please try again.',
          created_at: new Date().toISOString(),
          isError: true,
        },
      ])
    } finally {
      setIsSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function handleDeleteSession(e: React.MouseEvent, sessionId: number) {
    e.stopPropagation()
    try {
      await apiDeleteSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
        setMessages([])
      }
    } catch {
      // ignore — session stays in list
    }
  }

  function toggleSql(msgId: string) {
    setExpandedSql((prev) => {
      const next = new Set(prev)
      next.has(msgId) ? next.delete(msgId) : next.add(msgId)
      return next
    })
  }

  function toggleData(msgId: string) {
    setExpandedData((prev) => {
      const next = new Set(prev)
      next.has(msgId) ? next.delete(msgId) : next.add(msgId)
      return next
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const isEmpty = messages.length === 0 && !isSending

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="-m-4 lg:-m-6 flex overflow-hidden bg-slate-50" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <aside className="flex w-[250px] shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">Chat History</span>
          <button
            onClick={startNewChat}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Plus size={13} />
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {!sessionsLoaded ? (
            <div className="space-y-1.5 px-2 pt-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <MessageSquare size={28} className="mb-2 text-slate-200" />
              <p className="text-xs font-medium text-slate-400">No conversations yet</p>
              <p className="mt-0.5 text-[11px] text-slate-300">Start a new chat</p>
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => { if (s.id !== activeSessionId) void openSession(s.id) }}
                className={`group relative mx-2 cursor-pointer rounded-lg px-3 py-2.5 transition-colors ${
                  activeSessionId === s.id
                    ? 'bg-indigo-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <p
                  className={`truncate pr-6 text-xs font-medium leading-snug ${
                    activeSessionId === s.id ? 'text-indigo-700' : 'text-slate-700'
                  }`}
                >
                  {s.title}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{timeAgo(s.updated_at)}</p>
                <button
                  onClick={(e) => void handleDeleteSession(e, s.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main chat area ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
            <Sparkles size={16} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-800">SmartSupply AI Assistant</h1>
            <p className="text-[10px] text-slate-400">Powered by Gemini · Text-to-SQL</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
                <Sparkles size={28} className="text-indigo-400" />
              </div>
              <h2 className="mb-1 text-base font-semibold text-slate-700">
                Ask anything about your business
              </h2>
              <p className="mb-8 max-w-sm text-center text-sm text-slate-400">
                I can query your live database and give you instant answers about inventory,
                orders, revenue, factories, and more.
              </p>
              <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => void handleSend(q)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  sqlExpanded={expandedSql.has(msg.id)}
                  dataExpanded={expandedData.has(msg.id)}
                  onToggleSql={() => toggleSql(msg.id)}
                  onToggleData={() => toggleData(msg.id)}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-4 pt-3">
          {!isEmpty && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
                <button
                  key={q}
                  onClick={() => void handleSend(q)}
                  disabled={isSending}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.currentTarget.style.height = 'auto'
                e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 120)}px`
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your business…"
              disabled={isSending}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isSending}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right context panel ────────────────────────────────────────────── */}
      <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
        {/* Business Snapshot */}
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Business Snapshot
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
          <SnapshotStat
            label="Today's Orders"
            value={kpis?.total_orders}
            icon={<ShoppingCart size={14} className="text-indigo-500" />}
          />
          <SnapshotStat
            label="Low Stock"
            value={lowStock?.length}
            icon={<Package size={14} className="text-amber-500" />}
            warn={!!lowStock && lowStock.length > 0}
          />
          <SnapshotStat
            label="Active POs"
            value={kpis?.active_pos}
            icon={<ClipboardList size={14} className="text-green-500" />}
          />
        </div>

        {/* Quick actions */}
        <div className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Quick Actions
          </p>
          <div className="space-y-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => void handleSend(action.message)}
                disabled={isSending}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-left text-sm text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40"
              >
                {action.label} →
              </button>
            ))}
          </div>
        </div>

        {/* Tip card */}
        <div className="mx-4 mt-2 rounded-xl bg-indigo-50 p-4">
          <p className="mb-1 text-xs font-medium text-indigo-700">💡 Pro tip</p>
          <p className="text-xs leading-relaxed text-indigo-600">
            Ask follow-up questions — I remember the context of your conversation and refine my
            queries accordingly.
          </p>
        </div>
      </aside>
    </div>
  )
}
