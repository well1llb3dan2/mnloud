import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config/index.js';
import connectDB from './config/database.js';
import { initializeSocket } from './socket/index.js';
import { ConcentrateType, Order, User } from './models/index.js';
import { setServerVersion, setSocketServer } from './socket/bus.js';
import {
  authRoutes,
  userRoutes,
  priceTierRoutes,
  productRoutes,
  chatRoutes,
  orderRoutes,
  strainsRoutes,
  pushRoutes,
} from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build CORS origins list (filter out undefined values)
const corsOrigins = [
  config.cors.customerPortalUrl,
  config.cors.managerPortalUrl,
  config.cors.customerPortalTunnelUrl,
  config.cors.managerPortalTunnelUrl,
].filter(Boolean);

const isPrivateHost = (hostname) => (
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // allow non-browser clients
  if (corsOrigins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith('.nexgrex.com') || hostname === 'nexgrex.com') {
      return true;
    }
  } catch {
    // ignore parse errors
  }
  if (config.env === 'development') {
    try {
      const { hostname, protocol } = new URL(origin);
      return (protocol === 'http:' || protocol === 'https:') && isPrivateHost(hostname);
    } catch {
      return false;
    }
  }
  return false;
};

// Initialize express
const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(origin));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

initializeSocket(io);
setSocketServer(io);
setServerVersion(process.env.SERVER_BUILD_ID || new Date().toISOString());

// Connect to MongoDB
connectDB();

const defaultConcentrateTypes = [
  'Vape Cart',
  'Shatter',
  'Wax',
  'Badder',
  'Live Resin',
  'Rosin',
  'Distillate',
  'Sauce',
  'Diamond',
  'Crumble',
];

mongoose.connection.once('open', async () => {
  try {
    const existing = await ConcentrateType.countDocuments();
    if (existing === 0) {
      await ConcentrateType.insertMany(
        defaultConcentrateTypes.map((name) => ({
          name,
          nameLower: name.toLowerCase(),
        }))
      );
      console.log('Seeded default concentrate types');
    }

    const existingManagers = await User.countDocuments({ role: 'manager' });
    if (existingManagers === 0) {
      const seedManagerEmail = process.env.SEED_MANAGER_EMAIL?.toLowerCase().trim();
      const seedManagerPassword = process.env.SEED_MANAGER_PASSWORD;
      const seedManagerNickname = process.env.SEED_MANAGER_NICKNAME || 'Loud Manager';

      if (!seedManagerEmail || !seedManagerPassword) {
        console.warn('Manager seed skipped: SEED_MANAGER_EMAIL or SEED_MANAGER_PASSWORD not set');
      } else {
        const manager = new User({
          email: seedManagerEmail,
          password: seedManagerPassword,
          role: 'manager',
          nickname: seedManagerNickname,
        });
        await manager.save();
        console.log(`Created default manager: ${seedManagerEmail}`);
      }
    }
  } catch (error) {
    console.warn('Startup seed skipped:', error?.message || error);
  }
});

// Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});
app.use(cors({
  origin: (origin, callback) => {
    callback(null, isOriginAllowed(origin));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint (for wait-on)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/price-tiers', priceTierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/strains', strainsRoutes);
app.use('/api/push', pushRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(config.env === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Start server
const PORT = config.port;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.env}`);
});

const cleanupOrders = async () => {
  try {
    const now = Date.now();
    const cancelledCutoff = new Date(now - 24 * 60 * 60 * 1000);
    const completedCutoff = new Date(now - 48 * 60 * 60 * 1000);

    await Order.deleteMany({
      status: 'cancelled',
      updatedAt: { $lte: cancelledCutoff },
    });

    await Order.deleteMany({
      status: 'completed',
      updatedAt: { $lte: completedCutoff },
    });
  } catch (error) {
    console.warn('Order cleanup skipped:', error?.message || error);
  }
};

// Run cleanup on interval (hourly)
setInterval(cleanupOrders, 60 * 60 * 1000);
// Run once shortly after startup
setTimeout(cleanupOrders, 30 * 1000);

export { app, io };
