export interface Demand {
  _id?: string;
  recyclerId: string;
  category: string;
  quantityNeeded: number;
  unit: string;
  deliveryWindow: {
    start: Date;
    end: Date;
  };
  status: 'open' | 'partially_matched' | 'fully_matched' | 'fulfilled' | 'cancelled';
  matchedInventory: string[]; // inventory IDs
  createdAt: Date;
  updatedAt: Date;
}

export const demands: Demand[] = [];
