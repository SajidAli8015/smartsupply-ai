import client from './client'

export interface ChatSession {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  sql_query: string | null
  created_at: string
}

export interface ChatResponse {
  response: string
  sql_query: string | null
  data: Record<string, unknown>[] | null
  session_id: number
}

export const createSession = (firstMessage: string) =>
  client.post<ChatSession>('/ai/sessions', { first_message: firstMessage }).then((r) => r.data)

export const getSessions = () =>
  client.get<ChatSession[]>('/ai/sessions').then((r) => r.data)

export const getSessionMessages = (sessionId: number) =>
  client.get<ChatMessage[]>(`/ai/sessions/${sessionId}/messages`).then((r) => r.data)

export const sendMessage = (sessionId: number, message: string) =>
  client
    .post<ChatResponse>(`/ai/sessions/${sessionId}/chat`, { message })
    .then((r) => r.data)

export const deleteSession = (sessionId: number) =>
  client.delete(`/ai/sessions/${sessionId}`)
