// Copy dari web app dengan adaptasi untuk mobile
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  birth_date?: string;
  gender?: "Laki-laki" | "Perempuan";
  address?: string;
  city?: string;
  province?: string;
  bio?: string;
  total_reviews?: number;
  average_rating?: number;
  created_at: string;
  updated_at?: string;
}

export interface Brand {
  id: string;
  name: string;
  logo_url?: string;
  category?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface CarModel {
  id: string;
  brand_id?: string;
  name: string;
  full_name?: string;
  body_type?:
    | "Hatchback"
    | "MPV"
    | "SUV"
    | "Sedan"
    | "Wagon"
    | "Coupe"
    | "Van"
    | "Truck";
  is_active: boolean;
  created_at: string;
}

export interface Car {
  id: string;
  user_id: string;
  brand_id?: string;
  car_model_id?: string;
  location_id?: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  transmission: "Manual" | "Automatic" | "CVT" | "DCT";
  engine_capacity?: string;
  fuel_type: "Petrol" | "Diesel" | "Electric" | "Hybrid";
  body_type?: string;
  condition?: "Excellent" | "Good" | "Fair" | "Poor";
  color: string;
  description?: string;
  location: string;
  images: string[];
  video_url?: string;
  is_sold: boolean;
  is_draft?: boolean;
  is_verified?: boolean;
  views_count?: number;
  favorites_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  car_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "message" | "favorite" | "review" | "car_sold" | "system";
  title: string;
  message: string;
  is_read: boolean;
  data?: any;
  created_at: string;
}
