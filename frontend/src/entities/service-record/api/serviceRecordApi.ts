import { api } from '@/shared/api'
import type { ServiceRecord, ServiceRecordInput, ServiceStats } from '../model/types'

export async function getServiceRecords(carId: string) { return (await api.get<ServiceRecord[]>(`/cars/${carId}/service-records`)).data }
export async function createServiceRecord(carId: string, input: ServiceRecordInput) { return (await api.post<ServiceRecord>(`/cars/${carId}/service-records`, input)).data }
export async function deleteServiceRecord(id: string) { await api.delete(`/service-records/${id}`) }
export async function getServiceStats(carId: string) { return (await api.get<ServiceStats>(`/cars/${carId}/service-stats`)).data }
