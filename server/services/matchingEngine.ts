import { Demand, demands } from '../models/Demand';
import { inventory, InventoryItem } from '../models/Inventory';
import { Delivery, deliveries } from '../models/Delivery';
import { generateId } from '../utils/helpers';

interface MatchResult {
  demand: Demand;
  matchedItems: InventoryItem[];
  delivery?: Delivery;
  matchPercentage: number;
}

/**
 * Matching Engine - Core business logic
 * Matches recycler demands with available verified inventory
 */
export class MatchingEngine {
  /**
   * Find matching inventory for a demand
   */
  static findMatches(demand: Demand): InventoryItem[] {
    return inventory.filter(
      (item) =>
        item.category === demand.category &&
        item.status === 'verified' &&
        !item.matchedDemandId
    );
  }

  /**
   * Calculate distance between two points (simplified)
   */
  static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const deg2rad = (deg: number) => deg * (Math.PI / 180);
    const R = 6371; // km
    const dLat = deg2rad(lat2 - lat1);
    const dLng = deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Match a demand with available inventory
   */
  static matchDemand(demand: Demand, recyclerId: string): MatchResult {
    const availableItems = this.findMatches(demand);

    if (availableItems.length === 0) {
      return {
        demand,
        matchedItems: [],
        matchPercentage: 0,
      };
    }

    // Sort by proximity to recycler (simplified - just take first available)
    let totalQty = 0;
    const selectedItems: InventoryItem[] = [];

    for (const item of availableItems) {
      if (totalQty >= demand.quantityNeeded) break;
      selectedItems.push(item);
      totalQty += item.actualQty;
    }

    const matchPercentage = (totalQty / demand.quantityNeeded) * 100;

    // Mark items as matched
    selectedItems.forEach((item) => {
      item.status = 'matched';
      item.matchedDemandId = demand._id;
    });

    // Update demand status
    demand.matchedInventory = selectedItems.map((item) => item._id!);
    if (matchPercentage === 100) {
      demand.status = 'fully_matched';
    } else if (matchPercentage > 0) {
      demand.status = 'partially_matched';
    }

    return {
      demand,
      matchedItems: selectedItems,
      matchPercentage,
    };
  }

  /**
   * Create delivery task from matched demand
   */
  static createDeliveryTask(
    demand: Demand,
    pickupHubId: string,
    deliveryWorkerId: string
  ): Delivery {
    const matchedItems = inventory.filter((i) => demand.matchedInventory.includes(i._id!));

    const delivery: Delivery = {
      _id: generateId(),
      demandId: demand._id!,
      deliveryWorkerId,
      pickupHub: pickupHubId,
      dropoffRecycler: demand.recyclerId,
      manifest: matchedItems.map((item) => ({
        inventoryId: item._id!,
        qrCode: item.qrCode,
        category: item.category,
        qty: item.actualQty,
      })),
      status: 'assigned',
      pickupProof: {
        qrScanned: false,
      },
      dropoffProof: {
        qrScanned: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    deliveries.push(delivery);
    return delivery;
  }

  /**
   * Auto-match all open demands
   */
  static autoMatchAllDemands(deliveryWorkerPool: string[]): MatchResult[] {
    const openDemands = demands.filter((d) => d.status === 'open');
    const results: MatchResult[] = [];

    openDemands.forEach((demand, idx) => {
      const result = this.matchDemand(demand, demand.recyclerId);

      if (result.matchedItems.length > 0) {
        const deliveryWorker = deliveryWorkerPool[idx % deliveryWorkerPool.length];
        const delivery = this.createDeliveryTask(demand, '', deliveryWorker); // Empty hub ID for now
        result.delivery = delivery;
      }

      results.push(result);
    });

    return results;
  }

  /**
   * Get matching statistics
   */
  static getMatchingStats() {
    const totalDemands = demands.length;
    const matchedDemands = demands.filter((d) => d.status !== 'open').length;
    const matchRate = totalDemands > 0 ? (matchedDemands / totalDemands) * 100 : 0;

    return {
      totalDemands,
      matchedDemands,
      matchRate: Math.round(matchRate),
      pendingMatches: totalDemands - matchedDemands,
    };
  }
}
