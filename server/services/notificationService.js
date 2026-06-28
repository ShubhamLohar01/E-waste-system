import { notifications } from '../models/Notification.js';
import { nextId, PREFIX } from '../utils/idGenerator.js';

export function notify(userId, { title, message, type = 'info', relatedId = null }) {
  if (!userId) return;
  const note = {
    _id: nextId(PREFIX.NOTIFICATION),
    userId,
    title: String(title || 'Notification'),
    message: String(message || ''),
    type,
    relatedId,
    read: false,
    createdAt: new Date().toISOString(),
  };
  notifications.unshift(note);
  // keep last 200 per user
  const mine = notifications.filter((n) => n.userId === userId);
  if (mine.length > 200) {
    const drop = mine.slice(200);
    for (const d of drop) {
      const idx = notifications.findIndex((n) => n._id === d._id);
      if (idx >= 0) notifications.splice(idx, 1);
    }
  }
  return note;
}

export function notifyMany(userIds, payload) {
  return userIds.filter(Boolean).map((uid) => notify(uid, payload));
}
