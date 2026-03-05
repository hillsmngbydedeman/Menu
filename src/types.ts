export interface Settings {
  id: number;
  hotel_name: string;
  currency: 'IQD' | 'USD';
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string;
  translations: {
    name: Record<string, string>;
    description: Record<string, string>;
  };
  price: number;
  image_url: string;
  available: number;
}

export interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: number;
  category_id: number;
  location: string;
  items: OrderItem[];
  total_price: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  created_at: string;
}
