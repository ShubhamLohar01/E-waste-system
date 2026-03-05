// User Model - represents all 7 role types
export interface User {
  _id?: string;
  name: string;
  email: string;
  password: string; // hashed
  phone: string;
  role: 'small_user' | 'local_collector' | 'hub' | 'delivery_worker' | 'recycler' | 'bulk_generator' | 'admin';
  trustLevel: 'low' | 'medium' | 'high' | 'highest';
  assignedHub?: string; // for collectors
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  reliabilityScore?: number; // for delivery workers
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Mock storage - in production, use MongoDB
export const users: User[] = [];
