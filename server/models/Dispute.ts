export interface Dispute {
  _id?: string;
  raisedBy: string;
  against: string;
  deliveryId: string;
  type: 'quantity_mismatch' | 'category_mismatch' | 'damaged' | 'missing';
  description: string;
  evidence: string[];
  status: 'open' | 'investigating' | 'resolved';
  resolvedBy?: string;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const disputes: Dispute[] = [];
