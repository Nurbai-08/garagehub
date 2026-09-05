import { api } from '@/shared/api'
import type { Car, CarFilters, CarInput, PaginatedCars } from '../model/types'

export async function getCars(filters: CarFilters = {}) { return (await api.get<PaginatedCars>('/cars', { params: filters })).data }
export async function getCarBrands() { return (await api.get<string[]>('/cars/brands')).data }
export async function getCar(id: string) { return (await api.get<Car>(`/cars/${id}`)).data }
export async function getMyCars() { return (await api.get<Car[]>('/me/cars')).data }
export async function getUserCars(username: string) { return (await api.get<Car[]>(`/users/${username}/cars`)).data }
export async function createCar(input: CarInput) { return (await api.post<Car>('/cars', input)).data }
export async function updateCar(id: string, input: Partial<CarInput>) { return (await api.patch<Car>(`/cars/${id}`, input)).data }
export async function deleteCar(id: string) { await api.delete(`/cars/${id}`) }
export async function favoriteCar(id: string) { await api.put(`/cars/${id}/favorite`) }
export async function unfavoriteCar(id: string) { await api.delete(`/cars/${id}/favorite`) }
export async function getFavorites() { return (await api.get<Car[]>('/me/favorites')).data }
export async function rateCar(id: string, score: number) { return (await api.put<{ rating_avg: number; rating_count: number }>(`/cars/${id}/rating`, { score })).data }
