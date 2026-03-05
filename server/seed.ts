import { users } from './models/User';
import { rewards } from './models/Reward';
import { intents } from './models/Intent';
import { inventory } from './models/Inventory';
import { demands } from './models/Demand';
import { deliveries } from './models/Delivery';
import { disputes } from './models/Dispute';
import { hashPassword, generateId, generateQRCode } from './utils/helpers';

/**
 * Seed the database with demo data for all 7 roles
 */
export async function seedDatabase() {
  try {
    console.log('🌱 Seeding database with demo data...');

    // Clear existing data
    users.length = 0;
    rewards.length = 0;
    intents.length = 0;
    inventory.length = 0;
    demands.length = 0;
    deliveries.length = 0;
    disputes.length = 0;

    // Admin user
    const adminPassword = await hashPassword('admin123');
    const adminId = generateId();
    users.push({
      _id: adminId,
      name: 'Admin User',
      email: 'admin@ewaste.com',
      password: adminPassword,
      phone: '+91-9000000000',
      role: 'admin',
      trustLevel: 'highest',
      location: { lat: 28.6139, lng: 77.2090, address: 'Delhi, India' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Small Users (2)
    const smallUserIds = [];
    for (let i = 1; i <= 2; i++) {
      const password = await hashPassword('user123');
      const userId = generateId();
      smallUserIds.push(userId);
      users.push({
        _id: userId,
        name: `Small User ${i}`,
        email: `user${i}@ewaste.com`,
        password,
        phone: `+91-9000000${i}`,
        role: 'small_user',
        trustLevel: 'low',
        location: { lat: 28.6 + i * 0.1, lng: 77.2 + i * 0.1, address: `Address ${i}` },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create reward records for small users
      rewards.push({
        _id: generateId(),
        userId,
        totalPoints: Math.random() * 2000,
        currentStreak: Math.floor(Math.random() * 10),
        badges: [
          { name: 'Early Contributor', earnedAt: new Date() },
          { name: 'Eco Warrior', earnedAt: new Date() },
        ],
        milestones: [
          { threshold: 1000, reached: true, rewardType: 'silver_badge' },
          { threshold: 5000, reached: false, rewardType: 'gold_badge' },
        ],
        history: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Local Collectors (2)
    const collectorIds = [];
    for (let i = 1; i <= 2; i++) {
      const password = await hashPassword('collector123');
      const collectorId = generateId();
      collectorIds.push(collectorId);
      users.push({
        _id: collectorId,
        name: `Local Collector ${i}`,
        email: `collector${i}@ewaste.com`,
        password,
        phone: `+91-9100000${i}`,
        role: 'local_collector',
        trustLevel: 'medium',
        location: { lat: 28.7 + i * 0.05, lng: 77.3 + i * 0.05, address: `Collection Hub ${i}` },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Hubs (2)
    const hubIds = [];
    for (let i = 1; i <= 2; i++) {
      const password = await hashPassword('hub123');
      const hubId = generateId();
      hubIds.push(hubId);
      users.push({
        _id: hubId,
        name: `Main Hub ${i}`,
        email: `hub${i}@ewaste.com`,
        password,
        phone: `+91-9200000${i}`,
        role: 'hub',
        trustLevel: 'high',
        location: { lat: 28.5 + i * 0.2, lng: 77.1 + i * 0.2, address: `Hub Location ${i}` },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Delivery Workers (2)
    const deliveryWorkerIds = [];
    for (let i = 1; i <= 2; i++) {
      const password = await hashPassword('delivery123');
      const workerId = generateId();
      deliveryWorkerIds.push(workerId);
      users.push({
        _id: workerId,
        name: `Delivery Worker ${i}`,
        email: `delivery${i}@ewaste.com`,
        password,
        phone: `+91-9300000${i}`,
        role: 'delivery_worker',
        trustLevel: 'low',
        location: { lat: 28.65 + i * 0.1, lng: 77.25 + i * 0.1, address: `Service Area ${i}` },
        reliabilityScore: 85 + Math.random() * 15,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Recycling Companies (2)
    const recyclerIds = [];
    for (let i = 1; i <= 2; i++) {
      const password = await hashPassword('recycler123');
      const recyclerId = generateId();
      recyclerIds.push(recyclerId);
      users.push({
        _id: recyclerId,
        name: `Recycling Company ${i}`,
        email: `recycler${i}@ewaste.com`,
        password,
        phone: `+91-9400000${i}`,
        role: 'recycler',
        trustLevel: 'high',
        location: { lat: 28.4 + i * 0.15, lng: 77.0 + i * 0.15, address: `Recycling Plant ${i}` },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Bulk Generators (2)
    const bulkGeneratorIds = [];
    for (let i = 1; i <= 2; i++) {
      const password = await hashPassword('bulk123');
      const bulkId = generateId();
      bulkGeneratorIds.push(bulkId);
      users.push({
        _id: bulkId,
        name: `Bulk Generator ${i} (IT Company)`,
        email: `bulk${i}@ewaste.com`,
        password,
        phone: `+91-9500000${i}`,
        role: 'bulk_generator',
        trustLevel: 'high',
        location: { lat: 28.55 + i * 0.12, lng: 77.35 + i * 0.12, address: `Corporate Office ${i}` },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Create sample intents from small users
    for (let i = 0; i < smallUserIds.length; i++) {
      const intentId = generateId();
      intents.push({
        _id: intentId,
        userId: smallUserIds[i],
        type: 'small_user',
        items: [
          {
            category: 'Old Laptops',
            estimatedQty: 2 + i,
            unit: 'pieces',
            photos: [],
          },
          {
            category: 'Mobile Phones',
            estimatedQty: 5 + i,
            unit: 'pieces',
            photos: [],
          },
        ],
        status: 'assigned',
        assignedCollector: collectorIds[i % collectorIds.length],
        location: { lat: 28.6 + i * 0.1, lng: 77.2 + i * 0.1, address: `User Address ${i + 1}, Sector ${12 + i}, Delhi` },
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      });

      // Create inventory items in various states
      const states: Array<'submitted' | 'collected' | 'at_hub' | 'verified' | 'matched' | 'in_transit' | 'delivered' | 'processed'> = [
        'submitted',
        'collected',
        'at_hub',
        'verified',
        'matched',
        'in_transit',
        'delivered',
      ];

      states.forEach((status, idx) => {
        inventory.push({
          _id: generateId(),
          qrCode: generateQRCode(),
          intentId,
          category: ['Old Laptops', 'Mobile Phones', 'Cables', 'Monitors'][idx % 4],
          actualQty: 2 + idx,
          unit: 'pieces',
          condition: 'used',
          status,
          sourceUserId: smallUserIds[i],
          collectorId: status !== 'submitted' ? collectorIds[i % collectorIds.length] : undefined,
          hubId: ['at_hub', 'verified', 'matched', 'in_transit', 'delivered'].includes(status)
            ? hubIds[0]
            : undefined,
          deliveryWorkerId: ['in_transit', 'delivered'].includes(status)
            ? deliveryWorkerIds[0]
            : undefined,
          recyclerId: status === 'delivered' ? recyclerIds[0] : undefined,
          verificationPhotos: [],
          traceability: [
            {
              actor: smallUserIds[i],
              action: 'submitted',
              timestamp: new Date(),
              qrScanned: false,
            },
          ],
          createdAt: new Date(Date.now() - (7 - idx) * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        });
      });
    }

    // Create sample demands from recyclers
    for (let i = 0; i < recyclerIds.length; i++) {
      const categories = ['Old Laptops', 'Mobile Phones', 'Cables', 'Monitors'];
      for (let j = 0; j < 2; j++) {
        const demandId = generateId();
        demands.push({
          _id: demandId,
          recyclerId: recyclerIds[i],
          category: categories[j],
          quantityNeeded: 100 + Math.random() * 200,
          unit: 'pieces',
          deliveryWindow: {
            start: new Date(),
            end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          status: j === 0 ? 'open' : 'partially_matched',
          matchedInventory: j === 0 ? [] : inventory.filter(it => it.category === categories[j]).slice(0, 3).map(it => it._id!),
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        });
      }
    }

    // Create sample deliveries
    for (let i = 0; i < deliveryWorkerIds.length; i++) {
      const items = inventory.filter(it => it.status === 'verified').slice(0, 3);
      if (items.length > 0) {
        deliveries.push({
          _id: generateId(),
          demandId: demands[0]?._id || generateId(),
          deliveryWorkerId: deliveryWorkerIds[i],
          pickupHub: hubIds[0],
          dropoffRecycler: recyclerIds[i % recyclerIds.length],
          manifest: items.map(item => ({
            inventoryId: item._id!,
            qrCode: item.qrCode,
            category: item.category,
            qty: item.actualQty,
          })),
          status: i === 0 ? 'assigned' : 'picked_up',
          pickupProof: {
            qrScanned: i !== 0,
            timestamp: i !== 0 ? new Date() : undefined,
          },
          dropoffProof: {
            qrScanned: false,
          },
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        });
      }
    }

    // Create sample disputes
    if (deliveries.length > 0) {
      disputes.push({
        _id: generateId(),
        raisedBy: recyclerIds[0],
        against: deliveryWorkerIds[0],
        deliveryId: deliveries[0]._id!,
        type: 'quantity_mismatch',
        description: 'Received 2 items instead of 3 as per manifest',
        evidence: [],
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log('✅ Database seeded successfully!');
    console.log(`
🎯 Test Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Admin:
  Email: admin@ewaste.com
  Password: admin123

Small User:
  Email: user1@ewaste.com
  Password: user123

Local Collector:
  Email: collector1@ewaste.com
  Password: collector123

Hub:
  Email: hub1@ewaste.com
  Password: hub123

Delivery Worker:
  Email: delivery1@ewaste.com
  Password: delivery123

Recycler:
  Email: recycler1@ewaste.com
  Password: recycler123

Bulk Generator:
  Email: bulk1@ewaste.com
  Password: bulk123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
}

// Run seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}
