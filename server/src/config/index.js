import dotenv from 'dotenv';
dotenv.config();

export default {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/loud-cannabis',
  },

  strains: {
    uri:
      process.env.STRAINS_MONGODB_URI ||
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/strains',
  },
  
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '4h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },
  
  cors: {
    customerPortalUrl: process.env.CUSTOMER_PORTAL_URL || 'http://localhost:3000',
    managerPortalUrl: process.env.MANAGER_PORTAL_URL || 'http://localhost:3001',
    customerPortalTunnelUrl: process.env.CUSTOMER_PORTAL_TUNNEL_URL,
    managerPortalTunnelUrl: process.env.MANAGER_PORTAL_TUNNEL_URL,
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 20 * 1024 * 1024, // 20MB
    path: process.env.UPLOAD_PATH || 'uploads',
  },

  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT || 'mailto:support@mnloud.com',
  },
};
