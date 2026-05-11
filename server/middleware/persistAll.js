import { saveCollection } from '../lib/jsonDb.js';
import { users } from '../models/User.js';
import { rewards } from '../models/Reward.js';
import { intents } from '../models/Intent.js';
import { inventory } from '../models/Inventory.js';
import { demands } from '../models/Demand.js';
import { deliveries } from '../models/Delivery.js';
import { disputes } from '../models/Dispute.js';
import { notifications } from '../models/Notification.js';
import { payments } from '../models/Payment.js';

const COLLECTIONS = [
  ['users', users],
  ['rewards', rewards],
  ['intents', intents],
  ['inventory', inventory],
  ['demands', demands],
  ['deliveries', deliveries],
  ['disputes', disputes],
  ['notifications', notifications],
  ['payments', payments],
];

export function flushAll() {
  for (const [name, arr] of COLLECTIONS) saveCollection(name, arr);
}

export function persistAll(req, res, next) {
  res.on('finish', () => {
    const m = req.method;
    if (m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') {
      flushAll();
    }
  });
  next();
}
