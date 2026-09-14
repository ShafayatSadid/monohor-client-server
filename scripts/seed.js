// scripts/seed.js
require("dotenv").config();
const { getCollection, connectDB } = require("../lib/db");

async function seed() {
  await connectDB();
  console.log("Connected to DB");

  const categoriesCollection = await getCollection("categories");
  const productsCollection = await getCollection("products");

  // পুরোনো ডাটা মুছে ফেলুন (শুধু seed টেস্টের জন্য)
  await categoriesCollection.deleteMany({});
  await productsCollection.deleteMany({});
  console.log("Cleared old data");

  const categories = [
    { name: "আতর", slug: "attar", image: "", description: "Authentic Bengali attar", createdAt: new Date() },
    { name: "বাখুর", slug: "bakhur", image: "", description: "Bakhoor wood and oud chips", createdAt: new Date() },
    { name: "শোপিস", slug: "showpiece", image: "", description: "Wooden craft and clay art", createdAt: new Date() },
    { name: "হাতের কাজ", slug: "hater-kaj", image: "", description: "Handmade jewelry and nakshi kantha", createdAt: new Date() },
  ];

  await categoriesCollection.insertMany(categories);
  console.log("Categories inserted");

  const products = [
    { name: "Rose Attar", slug: "rose-attar", category: "attar", price: 350, stock: 20, images: [], description: "Pure rose attar from Rajshahi", rating: 4.5, featured: true, newArrival: true, bestSeller: true, createdAt: new Date() },
    { name: "Oud Attar", slug: "oud-attar", category: "attar", price: 850, stock: 15, images: [], description: "Premium oud attar", rating: 4.8, featured: true, newArrival: false, bestSeller: true, createdAt: new Date() },
    { name: "Musk Attar", slug: "musk-attar", category: "attar", price: 500, stock: 25, images: [], description: "Traditional musk attar", rating: 4.3, featured: false, newArrival: true, bestSeller: false, createdAt: new Date() },
    { name: "Bakhoor Wood", slug: "bakhoor-wood", category: "bakhur", price: 600, stock: 30, images: [], description: "Natural bakhoor wood", rating: 4.6, featured: true, newArrival: false, bestSeller: true, createdAt: new Date() },
    { name: "Oud Chips", slug: "oud-chips", category: "bakhur", price: 1200, stock: 10, images: [], description: "Premium oud chips", rating: 4.9, featured: true, newArrival: true, bestSeller: true, createdAt: new Date() },
    { name: "Incense Stick", slug: "incense-stick", category: "bakhur", price: 150, stock: 50, images: [], description: "Handmade incense sticks", rating: 4.2, featured: false, newArrival: true, bestSeller: false, createdAt: new Date() },
    { name: "Wooden Craft", slug: "wooden-craft", category: "showpiece", price: 950, stock: 8, images: [], description: "Handcrafted wooden showpiece", rating: 4.7, featured: true, newArrival: false, bestSeller: true, createdAt: new Date() },
    { name: "Clay Art", slug: "clay-art", category: "showpiece", price: 400, stock: 20, images: [], description: "Traditional clay art", rating: 4.4, featured: false, newArrival: true, bestSeller: false, createdAt: new Date() },
    { name: "Nakshi Kantha", slug: "nakshi-kantha", category: "hater-kaj", price: 2500, stock: 5, images: [], description: "Handmade nakshi kantha", rating: 5.0, featured: true, newArrival: false, bestSeller: true, createdAt: new Date() },
    { name: "Handmade Jewelry", slug: "handmade-jewelry", category: "hater-kaj", price: 700, stock: 15, images: [], description: "Traditional handmade jewelry", rating: 4.5, featured: false, newArrival: true, bestSeller: false, createdAt: new Date() },
  ];

  await productsCollection.insertMany(products);
  console.log("Products inserted");

  console.log("Seed complete ✅");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});