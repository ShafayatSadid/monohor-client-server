// lib/db.js
const { MongoClient } = require("mongodb");
const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const uri = process.env.MONGODB_URI;
const dbName = "monohor";

if (!uri) {
  throw new Error("MONGODB_URI is not defined in .env");
}

let cachedClient = global._mongoClient;
let cachedDb = global._mongoDb;

async function connectDB() {
  if (cachedDb) return cachedDb;

  if (!cachedClient) {
    cachedClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    await cachedClient.connect();
    global._mongoClient = cachedClient;
  }

  cachedDb = cachedClient.db(dbName);
  global._mongoDb = cachedDb;

  return cachedDb;
}

async function getCollection(name) {
  const db = await connectDB();
  return db.collection(name);
}

module.exports = { connectDB, getCollection };