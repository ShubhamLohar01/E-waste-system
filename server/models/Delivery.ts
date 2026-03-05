export interface Delivery {
  _id?: string;
  demandId: string;
  deliveryWorkerId: string;
  pickupHub: string;
  dropoffRecycler: string;
  manifest: Array<{
    inventoryId: string;
    qrCode: string;
    category: string;
    qty: number;
  }>;
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'disputed';
  pickupProof: {
    qrScanned: boolean;
    photo?: string;
    timestamp?: Date;
  };
  dropoffProof: {
    qrScanned: boolean;
    photo?: string;
    timestamp?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const deliveries: Delivery[] = [];
