export type Category = 'Coffee' | 'Tea' | 'Food' | 'Ingredient';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
  currentStock: number;
  unit: string;
  minStock: number;
  updatedAt: string;
  priceM?: number;
  priceL?: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  size?: 'M' | 'L';
}

export interface Order {
  id: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'completed' | 'cancelled';
  createdAt: string;
  createdBy?: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  relatedObjectId?: string;
}
