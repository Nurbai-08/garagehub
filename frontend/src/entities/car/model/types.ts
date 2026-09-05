export type Car = {
  id: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  power_hp: number | null;
  drivetrain: string | null;
  generation: string | null;
  trim: string | null;
  cover_image_url: string;
  image_urls: string[];
  description: string | null;
  is_public: boolean;
  owner_username: string;
  rating_avg: number;
  rating_count: number;
  favorites_count: number;
  is_favorite?: boolean;
  my_rating?: number | null;
};

export type CarInput = {
  brand: string;
  model: string;
  year: number;
  mileage: number;
  power_hp?: number | null;
  drivetrain?: string | null;
  generation?: string | null;
  trim?: string | null;
  cover_image_url: string;
  image_urls: string[];
  description?: string | null;
  is_public: boolean;
};

export type PaginatedCars = {
  items: Car[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};
export type CarFilters = {
  search?: string;
  brand?: string;
  year_from?: number;
  year_to?: number;
  power_from?: number;
  power_to?: number;
  drivetrain?: string;
  sort?: "newest" | "rating" | "popular";
  page?: number;
};
