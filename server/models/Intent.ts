export interface Intent {
  _id?: string;
  userId: string;
  type: 'small_user' | 'bulk_generator';
  items: Array<{
    category: string;
    estimatedQty: number;
    unit: string;
    photos: string[];
    condition?: string;
    purchaseDate?: string;
  }>;
  status: 'submitted' | 'assigned' | 'collected' | 'cancelled';
  assignedCollector?: string;
  assignedRoute?: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const intents: Intent[] = [];
