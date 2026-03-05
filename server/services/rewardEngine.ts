import { Reward, rewards } from '../models/Reward';
import { users, User } from '../models/User';
import { inventory } from '../models/Inventory';
import { generateId } from '../utils/helpers';

/**
 * Reward Engine - Handles gamification and behavioral incentives
 * Key: Not cash-based, milestone-based, post-verification only
 */
export class RewardEngine {
  private static readonly POINTS_PER_KG = 1;
  private static readonly POINTS_PER_ITEM = 5;
  private static readonly STREAK_INCREMENT = 1;
  private static readonly STREAK_RESET_DAYS = 7;

  /**
   * Calculate points earned from an inventory item
   */
  static calculatePoints(quantity: number, unit: string): number {
    if (unit === 'kg') {
      return Math.floor(quantity * this.POINTS_PER_KG);
    } else if (unit === 'pieces' || unit === 'items') {
      return quantity * this.POINTS_PER_ITEM;
    }
    return 10; // default
  }

  /**
   * Award points to a user (called after inventory item is processed)
   */
  static awardPoints(userId: string, inventoryId: string, quantity: number, unit: string): Reward | null {
    const reward = rewards.find((r) => r.userId === userId);
    if (!reward) {
      console.warn(`No reward record found for user ${userId}`);
      return null;
    }

    const points = this.calculatePoints(quantity, unit);
    reward.totalPoints += points;
    reward.currentStreak += this.STREAK_INCREMENT;

    // Add to history
    reward.history.push({
      action: 'points_earned',
      points,
      inventoryId,
      timestamp: new Date(),
    });

    reward.updatedAt = new Date();
    return reward;
  }

  /**
   * Check and award badges based on milestones
   */
  static checkAndAwardBadges(userId: string): Reward | null {
    const reward = rewards.find((r) => r.userId === userId);
    if (!reward) return null;

    const badges = [
      { threshold: 100, name: 'First Step', earned: false },
      { threshold: 500, name: 'Growing Green', earned: false },
      { threshold: 1000, name: 'Silver Champion', earned: false },
      { threshold: 2500, name: 'Gold Guardian', earned: false },
      { threshold: 5000, name: 'Platinum Pioneer', earned: false },
      { threshold: 10000, name: 'Diamond Advocate', earned: false },
    ];

    badges.forEach((badge) => {
      const alreadyEarned = reward.badges.some((b) => b.name === badge.name);
      if (reward.totalPoints >= badge.threshold && !alreadyEarned) {
        reward.badges.push({
          name: badge.name,
          earnedAt: new Date(),
        });
      }
    });

    return reward;
  }

  /**
   * Check milestone progress
   */
  static checkMilestones(userId: string): Reward | null {
    const reward = rewards.find((r) => r.userId === userId);
    if (!reward) return null;

    reward.milestones.forEach((milestone) => {
      if (reward.totalPoints >= milestone.threshold) {
        milestone.reached = true;
      }
    });

    return reward;
  }

  /**
   * Award points for a completed inventory item
   * Called when item reaches 'processed' state
   */
  static awardCompletionPoints(userId: string, inventoryId: string): Reward | null {
    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return null;

    // Only award if item is processed
    if (item.status !== 'processed') {
      console.warn(`Item ${inventoryId} is not processed yet`);
      return null;
    }

    const reward = this.awardPoints(userId, inventoryId, item.actualQty, item.unit);
    if (!reward) return null;

    this.checkAndAwardBadges(userId);
    this.checkMilestones(userId);

    return reward;
  }

  /**
   * Reset streak if user hasn't contributed in X days
   */
  static resetStreakIfNeeded(userId: string): void {
    const reward = rewards.find((r) => r.userId === userId);
    if (!reward) return;

    const lastAction = reward.history[reward.history.length - 1];
    if (!lastAction) {
      reward.currentStreak = 0;
      return;
    }

    const daysSinceAction = Math.floor(
      (new Date().getTime() - lastAction.timestamp.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceAction > this.STREAK_RESET_DAYS) {
      reward.currentStreak = 0;
    }
  }

  /**
   * Get reward summary for a user
   */
  static getRewardSummary(userId: string): {
    totalPoints: number;
    currentStreak: number;
    badges: string[];
    nextMilestone: { threshold: number; pointsNeeded: number } | null;
  } | null {
    const reward = rewards.find((r) => r.userId === userId);
    if (!reward) return null;

    // Find next unreached milestone
    const nextMilestone = reward.milestones.find((m) => !m.reached);
    const pointsToNextMilestone = nextMilestone
      ? nextMilestone.threshold - reward.totalPoints
      : null;

    return {
      totalPoints: reward.totalPoints,
      currentStreak: reward.currentStreak,
      badges: reward.badges.map((b) => b.name),
      nextMilestone: nextMilestone
        ? { threshold: nextMilestone.threshold, pointsNeeded: pointsToNextMilestone || 0 }
        : null,
    };
  }

  /**
   * Tier-based benefits (non-monetary)
   */
  static getBenefitsForTier(
    totalPoints: number
  ): { tier: string; benefits: string[] } {
    if (totalPoints >= 5000) {
      return {
        tier: 'Platinum',
        benefits: [
          'Priority pickup scheduling',
          '20% discount on partner services',
          'Monthly newsletter',
          'Community recognition',
        ],
      };
    } else if (totalPoints >= 1000) {
      return {
        tier: 'Gold',
        benefits: [
          'Standard pickup scheduling',
          '10% discount on partner services',
          'Community forum access',
        ],
      };
    } else {
      return {
        tier: 'Silver',
        benefits: ['Basic pickup scheduling', 'Community forum access'],
      };
    }
  }
}
