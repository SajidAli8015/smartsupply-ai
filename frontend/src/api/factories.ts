import client from './client'
import type { Factory, PagedResponse } from '../types'

export interface FactoryCreatePayload {
  name: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  lead_time_days?: number
  is_active?: boolean
}

export type FactoryUpdatePayload = Partial<FactoryCreatePayload>

export const getFactories = (page = 1, pageSize = 100) =>
  client
    .get<PagedResponse<Factory>>('/factories', { params: { page, page_size: pageSize } })
    .then((r) => r.data)

export const createFactory = (data: FactoryCreatePayload) =>
  client.post<Factory>('/factories', data).then((r) => r.data)

export const updateFactory = (id: number, data: FactoryUpdatePayload) =>
  client.put<Factory>(`/factories/${id}`, data).then((r) => r.data)

export const deleteFactory = (id: number) => client.delete(`/factories/${id}`)
