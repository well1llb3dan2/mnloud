import {
  getVapidPublicKey,
  registerSubscription,
  removeSubscription,
} from '../services/pushService.js';

export const getVapidKey = async (req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(500).json({ message: 'Push notifications not configured' });
  }
  res.json({ publicKey: key });
};

export const subscribe = async (req, res) => {
  try {
    const { subscription, portal } = req.body;
    const userAgent = req.headers['user-agent'];

    await registerSubscription({
      userId: req.user._id,
      role: req.user.role,
      portal: portal || req.user.role,
      subscription,
      userAgent,
    });

    res.json({ message: 'Subscribed' });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(400).json({ message: error.message || 'Failed to subscribe' });
  }
};

export const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await removeSubscription(endpoint);
    res.json({ message: 'Unsubscribed' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(400).json({ message: 'Failed to unsubscribe' });
  }
};
