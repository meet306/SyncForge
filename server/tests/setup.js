import { connectDB, disconnectDB } from '../src/config/db.js';
import mongoose from 'mongoose';

export async function setupTestDB() {
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/syncforge_test';
  process.env.NODE_ENV = 'test';
  await connectDB();
}

export async function teardownTestDB() {
  // Safe teardown per test suite without closing global connection prematurely
}

export async function closeTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await disconnectDB();
  }
}
