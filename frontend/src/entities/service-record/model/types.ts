export type ServiceRecord = { id: string; car_id: string; category: string; title: string; description: string | null; service_date: string; mileage: number | null; cost: string; currency: string; location: string | null; is_public: boolean; created_at: string }
export type ServiceRecordInput = Omit<ServiceRecord, 'id' | 'car_id' | 'created_at' | 'cost'> & { cost: number }
export type ServiceStats = { total: string; currency: string; by_category: Record<string, string>; by_month: Record<string, string> }
