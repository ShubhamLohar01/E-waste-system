import { rewards } from '../models/Reward';
import { inventory } from '../models/Inventory';
import { nextId, PREFIX } from '../utils/idGenerator.js';

/**
 * Reward Engine — tracks a simple point counter per user.
 * Points are awarded when an inventory item transitions to 'processed'
 * (= admin has marked the payment as collected from the recycler).
 *
 * Three actors earn points per processed item:
 *   • sourceUserId (small_user)
 *   • collectorId  (local_collector)
 *   • hubId        (hub)
 */
export class RewardEngine {
  static POINTS_PER_KG = 1;
  static POINTS_PER_ITEM = 5;

  static calculatePoints(quantity, unit) {
    if (unit === 'kg') return Math.floor(Number(quantity) * this.POINTS_PER_KG);
    if (unit === 'pieces' || unit === 'items') return Number(quantity) * this.POINTS_PER_ITEM;
    return 10;
  }

  /** Award `points` to a user's reward record (creates one on demand). */
  static awardPoints(userId, inventoryId, points, reason = 'item_processed') {
    if (!userId || !Number.isFinite(points) || points <= 0) return null;
    let reward = rewards.find((r) => r.userId === userId);
    if (!reward) {
      reward = {
        _id: nextId(PREFIX.REWARD),
        userId,
        totalPoints: 0,
        currentStreak: 0,
        badges: [],
        milestones: [
          { threshold: 100, reached: false, rewardType: 'bronze' },
          { threshold: 500, reached: false, rewardType: 'silver' },
          { threshold: 1000, reached: false, rewardType: 'gold' },
          { threshold: 5000, reached: false, rewardType: 'platinum' },
        ],
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      rewards.push(reward);
    }
    reward.totalPoints += points;
    reward.currentStreak = (reward.currentStreak || 0) + 1;
    reward.history.push({
      action: reason,
      points,
      inventoryId,
      timestamp: new Date().toISOString(),
    });
    reward.updatedAt = new Date().toISOString();
    this.checkAndAwardBadges(userId);
    this.checkMilestones(userId);
    return reward;
  }

  static checkAndAwardBadges(userId) {
    const reward = rewards.find((r) => r.userId === userId);
    if (!reward) return null;
    const badgeDefs = [
      { threshold: 100, name: 'First Step' },
      { threshold: 500, name: 'Growing Green' },
      { threshold: 1000, name: 'Silver Champion' },
      { threshold: 2500, name: 'Gold Guardian' },
      { threshold: 5000, name: 'Platinum Pioneer' },
      { threshold: 10000, name: 'Diamond Advocate' },
    ];
    badgeDefs.forEach((b) => {
      const already = reward.badges.some((x) => x.name === b.name);
      if (reward.totalPoints >= b.threshold && !already) {
        reward.badges.push({ name: b.name, earnedAt: new Date().toISOString() });
      }
    });
    return reward;
  }

  static checkMilestones(userId) {
    const reward = rewards.find((r) => r.userId === userId);
    if (!reward) return null;
    reward.milestones.forEach((m) => {
      if (reward.totalPoints >= m.threshold) m.reached = true;
    });
    return reward;
  }

  /**
   * Award points to the three participants when an item becomes 'processed'.
   * Returns { sourceUser, collector, hub } with points each received.
   */
  static awardTripleOnProcessed(item) {
    if (!item) return null;
    const basePoints = this.calculatePoints(item.actualQty, item.unit);
    const out = { sourceUser: 0, collector: 0, hub: 0 };
    if (item.sourceUserId) {
      this.awardPoints(item.sourceUserId, item._id, basePoints, 'item_processed_source');
      out.sourceUser = basePoints;
    }
    if (item.collectorId) {
      const p = Math.max(1, Math.round(basePoints * 0.5));
      this.awardPoints(item.collectorId, item._id, p, 'item_processed_collector');
      out.collector = p;
    }
    if (item.hubId) {
      const p = Math.max(1, Math.round(basePoints * 0.3));
      this.awardPoints(item.hubId, item._id, p, 'item_processed_hub');
      out.hub = p;
    }
    return out;
  }

  static getRewardSummary(userId) {
    const reward = rewards.find((r) => r.userId === userId);
    if (!reward) return null;
    const nextMilestone = reward.milestones.find((m) => !m.reached);
    return {
      totalPoints: reward.totalPoints,
      currentStreak: reward.currentStreak,
      badges: reward.badges.map((b) => b.name),
      nextMilestone: nextMilestone
        ? {
            threshold: nextMilestone.threshold,
            pointsNeeded: Math.max(0, nextMilestone.threshold - reward.totalPoints),
          }
        : null,
    };
  }

  static getBenefitsForTier(totalPoints) {
    if (totalPoints >= 5000)
      return { tier: 'Platinum', benefits: ['Priority pickup scheduling', '20% discount on partner services'] };
    if (totalPoints >= 1000) return { tier: 'Gold', benefits: ['Standard pickup scheduling', '10% discount'] };
    return { tier: 'Silver', benefits: ['Basic pickup scheduling'] };
  }
}
