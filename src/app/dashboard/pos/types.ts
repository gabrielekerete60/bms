

export type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  image: string;
  'data-ai-hint': string;
  costPrice?: number;
};

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  costPrice?: number;
};

export type CompletedOrder = {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  date: string; // Changed to string to ensure consistency
  paymentMethod: 'POS' | 'Cash' | 'Paystack' | 'Credit';
  customerName?: string;
  status: 'Completed' | 'Pending' | 'Cancelled';
};

export type User = {
  name: string;
  role: string;
  staff_id: string;
  email: string;
};

export type SelectableStaff = {
    staff_id: string;
    name: string;
    role: string;
};

    
