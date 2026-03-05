export interface Reward {
  _id?: string;
  userId: string;
  totalPoints: number;
  currentStreak: number;
  badges: Array<{
    name: string;
    earnedAt: Date;
  }>;
  milestones: Array<{
    threshold: number;
    reached: boolean;
    rewardType: string;
  }>;
  history: Array<{
    action: string;
    points: number;
    inventoryId?: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export const rewards: Reward[] = [];
