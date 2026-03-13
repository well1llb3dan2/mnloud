import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { User, PriceTier, BulkFlower, PackagedFlower, Edible } from '../models/index.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/loud-cannabis';

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const customerEmail = 'customer@loud.com';
    const customerEmailLower = customerEmail.toLowerCase().trim();
    const customerEmailHash = crypto
      .createHash('sha256')
      .update(customerEmailLower)
      .digest('hex');
    const existingCustomer = await User.findOne({ emailHash: customerEmailHash });

    if (existingCustomer) {
      console.log('Customer already exists: customer@loud.com');
    } else {
      const customer = new User({
        email: customerEmailLower,
        password: 'customer123',
        role: 'customer',
        nickname: 'Test Customer',
      });
      await customer.save();
      console.log('Created default customer: customer@loud.com / customer123');
    }

    const managerEmail = 'manager@loud.com';
    const managerEmailLower = managerEmail.toLowerCase().trim();
    const managerEmailHash = crypto
      .createHash('sha256')
      .update(managerEmailLower)
      .digest('hex');
    const existingManager = await User.findOne({ emailHash: managerEmailHash });

    if (existingManager) {
      console.log('Manager already exists: manager@loud.com');
    } else {
      const manager = new User({
        email: managerEmailLower,
        password: 'manager123',
        role: 'manager',
        nickname: 'Loud Manager',
      });
      await manager.save();
      console.log('Created default manager: manager@loud.com / manager123');
    }

    console.log('\n✅ Database seeded successfully!');
    console.log('\nCustomer login:');
    console.log('  Email: customer@loud.com');
    console.log('  Password: customer123');

    console.log('\nManager login:');
    console.log('  Email: manager@loud.com');
    console.log('  Password: manager123');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();
