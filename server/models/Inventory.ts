export interface InventoryItem {
  _id?: string;
  /** Collection ID when collector collects: PYYYYMMDD001 format */
  collectionId?: string;
  qrCode: string; // unique
  intentId?: string;
  category: string;
  actualQty: number;
  unit: string;
  condition: string;
  status: 'submitted' | 'collected' | 'at_hub' | 'verified' | 'matched' | 'in_transit' | 'delivered' | 'processed';
  sourceUserId: string;
  collectorId?: string;
  hubId?: string;
  deliveryWorkerId?: string;
  recyclerId?: string;
  verificationPhotos: string[];
  hubVerifiedAt?: Date;
  matchedDemandId?: string;
  traceability: Array<{
    actor: string;
    action: string;
    timestamp: Date;
    qrScanned: boolean;
    photo?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export const inventory: InventoryItem[] = [];
