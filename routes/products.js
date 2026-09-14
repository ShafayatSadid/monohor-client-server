// routes/products.js
const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../lib/db");

const router = express.Router();

// GET /products — filter, sort, search সব একসাথে
router.get("/", async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      sort,
      search,
      featured,
      newArrival,
      bestSeller,
    } = req.query;

    const query = {};

    if (category) query.category = category;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (featured === "true") query.featured = true;
    if (newArrival === "true") query.newArrival = true;
    if (bestSeller === "true") query.bestSeller = true;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    let sortOption = { createdAt: -1 }; // default: newest
    if (sort === "price_asc") sortOption = { price: 1 };
    else if (sort === "price_desc") sortOption = { price: -1 };
    else if (sort === "popular") sortOption = { rating: -1 };
    else if (sort === "newest") sortOption = { createdAt: -1 };

    const collection = await getCollection("products");
    const products = await collection.find(query).sort(sortOption).toArray();

    res.send(products);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// GET /products/:slug — একক প্রোডাক্ট
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const collection = await getCollection("products");
    const product = await collection.findOne({ slug });

    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }

    res.send(product);
  } catch (err) {
    console.error("GET /products/:slug error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// POST /products — নতুন প্রোডাক্ট
// TODO: পরে requireAdmin middleware যোগ করবেন
router.post("/", async (req, res) => {
  try {
    const {
      name,
      slug,
      category,
      price,
      stock,
      images,
      description,
      featured,
      newArrival,
      bestSeller,
    } = req.body;

    // Required field check
    if (!name || !slug || !category || price === undefined) {
      return res.status(400).send({
        message: "name, slug, category and price are required",
      });
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).send({ message: "Invalid price" });
    }

    const stockNum = stock !== undefined ? Number(stock) : 0;
    if (isNaN(stockNum) || stockNum < 0) {
      return res.status(400).send({ message: "Invalid stock" });
    }

    // Category আছে কিনা চেক
    const categoryCollection = await getCollection("categories");
    const categoryExists = await categoryCollection.findOne({ slug: category });
    if (!categoryExists) {
      return res.status(400).send({ message: "Category not found" });
    }

    const collection = await getCollection("products");

    // Slug duplicate চেক
    const existing = await collection.findOne({ slug });
    if (existing) {
      return res.status(409).send({ message: "Slug already exists" });
    }

    const newProduct = {
      name,
      slug,
      category,
      price: priceNum,
      stock: stockNum,
      images: Array.isArray(images) ? images : [],
      description: description || "",
      rating: 0,
      featured: Boolean(featured),
      newArrival: newArrival !== undefined ? Boolean(newArrival) : true,
      bestSeller: Boolean(bestSeller),
      createdAt: new Date(),
    };

    const result = await collection.insertOne(newProduct);

    res.status(201).send({
      message: "Product created",
      insertedId: result.insertedId,
      product: { _id: result.insertedId, ...newProduct },
    });
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// PATCH /products/:id — আপডেট
// TODO: পরে requireAdmin middleware যোগ করবেন
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid id" });
    }

    const collection = await getCollection("products");

    const allowed = [
      "name",
      "slug",
      "category",
      "price",
      "stock",
      "images",
      "description",
      "rating",
      "featured",
      "newArrival",
      "bestSeller",
    ];

    const updateDoc = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateDoc[key] = req.body[key];
    }

    if (Object.keys(updateDoc).length === 0) {
      return res.status(400).send({ message: "No fields to update" });
    }

    // Number convert
    if (updateDoc.price !== undefined) {
      updateDoc.price = Number(updateDoc.price);
      if (isNaN(updateDoc.price) || updateDoc.price < 0) {
        return res.status(400).send({ message: "Invalid price" });
      }
    }
    if (updateDoc.stock !== undefined) {
      updateDoc.stock = Number(updateDoc.stock);
      if (isNaN(updateDoc.stock) || updateDoc.stock < 0) {
        return res.status(400).send({ message: "Invalid stock" });
      }
    }
    if (updateDoc.rating !== undefined) {
      updateDoc.rating = Number(updateDoc.rating);
    }

    // slug বদলালে duplicate চেক
    if (updateDoc.slug) {
      const duplicate = await collection.findOne({
        slug: updateDoc.slug,
        _id: { $ne: new ObjectId(id) },
      });
      if (duplicate) {
        return res.status(409).send({ message: "Slug already exists" });
      }
    }

    // category বদলালে exist চেক
    if (updateDoc.category) {
      const categoryCollection = await getCollection("categories");
      const categoryExists = await categoryCollection.findOne({
        slug: updateDoc.category,
      });
      if (!categoryExists) {
        return res.status(400).send({ message: "Category not found" });
      }
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Product not found" });
    }

    const updated = await collection.findOne({ _id: new ObjectId(id) });
    res.send({ message: "Product updated", product: updated });
  } catch (err) {
    console.error("PATCH /products/:id error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// DELETE /products/:id
// TODO: পরে requireAdmin middleware যোগ করবেন
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid id" });
    }

    const collection = await getCollection("products");
    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Product not found" });
    }

    res.send({ message: "Product deleted", deletedId: id });
  } catch (err) {
    console.error("DELETE /products/:id error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

module.exports = router;