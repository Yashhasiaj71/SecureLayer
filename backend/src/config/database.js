'use strict';

const mongoose = require('mongoose');
const config = require('./environment');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    const conn = await mongoose.connect(config.db.uri, {
      // Mongoose 6+ has these defaults, but explicit is better
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    // Log host only — never log connection string (may contain credentials)
    console.log(`[DB] Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[DB] Connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
