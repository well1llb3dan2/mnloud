import webpush from 'web-push';
import config from '../config/index.js';
import { PushSubscription, User } from '../models/index.js';

let isConfigured = false;

const ensureConfigured = () => {
  if (isConfigured) return true;
  const { publicKey, privateKey, subject } = config.push || {};
  if (!publicKey || !privateKey) {
    return false;
  }
  webpush.setVapidDetails(subject || 'mailto:support@mnloud.com', publicKey, privateKey);
  isConfigured = true;
  return true;
};

const sendToSubscription = async (subscription, payload) => {
  if (!ensureConfigured()) return;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error) {
    const status = error?.statusCode;
    if (status === 404 || status === 410) {
      await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
    } else {
      console.warn('Push send failed:', error?.message || error);
    }
  }
};

export const getVapidPublicKey = () => config.push?.publicKey || null;

export const registerSubscription = async ({ userId, role, portal, subscription, userAgent }) => {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error('Invalid subscription payload');
  }

  const payload = {
    user: userId,
    role,
    portal,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    userAgent,
  };

  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { $set: payload },
    { upsert: true, new: true }
  );
};

export const removeSubscription = async (endpoint) => {
  if (!endpoint) return;
  await PushSubscription.deleteOne({ endpoint });
};

export const sendPushToUser = async (userId, payload) => {
  if (!ensureConfigured()) return;
  const user = await User.findById(userId).select('muteNotifications').lean();
  if (user?.muteNotifications) return;
  const subscriptions = await PushSubscription.find({ user: userId });
  await Promise.all(subscriptions.map((sub) => sendToSubscription(sub, payload)));
};

export const sendPushToRole = async (role, payload) => {
  if (!ensureConfigured()) return;
  const mutedUsers = await User.find({ role, muteNotifications: true }).select('_id').lean();
  const mutedIds = new Set(mutedUsers.map((u) => u._id.toString()));
  const subscriptions = await PushSubscription.find({ role });
  const active = subscriptions.filter((sub) => !mutedIds.has(sub.user.toString()));
  await Promise.all(active.map((sub) => sendToSubscription(sub, payload)));
};
