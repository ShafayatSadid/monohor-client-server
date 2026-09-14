// routes/categories.js
const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../lib/db");

const router = express.Router();

// GET /categories — সব ক্যাটাগরি
router.get("/", async (req, res) => {
  try {
    const collection = await getCollection("categories");
    const categories = await collection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.send(categories);
  } catch (err) {
    console.error("GET /categories error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// GET /categories/:slug — একটা ক্যাটাগরি slug দিয়ে
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const collection = await getCollection("categories");
    const category = await collection.findOne({ slug });

    if (!category) {
      return res.status(404).send({ message: "Category not found" });
    }

    res.send(category);
  } catch (err) {
    console.error("GET /categories/:slug error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// POST /categories — নতুন ক্যাটাগরি
// TODO: পরে requireAdmin middleware যোগ করবেন
router.post("/", async (req, res) => {
  try {
    const { name, slug, image, description } = req.body;

    if (!name || !slug) {
      return res.status(400).send({ message: "name and slug required" });
    }

    const collection = await getCollection("categories");

    const existing = await collection.findOne({ slug });
    if (existing) {
      return res.status(409).send({ message: "Slug already exists" });
    }

    const newCategory = {
      name,
      slug,
      image: image || "",
      description: description || "",
      createdAt: new Date(),
    };

    const result = await collection.insertOne(newCategory);

    res.status(201).send({
      message: "Category created",
      insertedId: result.insertedId,
      category: { _id: result.insertedId, ...newCategory },
    });
  } catch (err) {
    console.error("POST /categories error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// PATCH /categories/:id — আপডেট
// TODO: পরে requireAdmin middleware যোগ করবেন
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid id" });
    }

    const collection = await getCollection("categories");

    // শুধু allowed ফিল্ড নিন
    const { name, slug, image, description } = req.body;
    const updateDoc = {};
    if (name !== undefined) updateDoc.name = name;
    if (slug !== undefined) updateDoc.slug = slug;
    if (image !== undefined) updateDoc.image = image;
    if (description !== undefined) updateDoc.description = description;

    if (Object.keys(updateDoc).length === 0) {
      return res.status(400).send({ message: "No fields to update" });
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

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Category not found" });
    }

    const updated = await collection.findOne({ _id: new ObjectId(id) });
    res.send({ message: "Category updated", category: updated });
  } catch (err) {
    console.error("PATCH /categories/:id error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// DELETE /categories/:id
// TODO: পরে requireAdmin middleware যোগ করবেন
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid id" });
    }

    const collection = await getCollection("categories");
    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Category not found" });
    }

    res.send({ message: "Category deleted", deletedId: id });
  } catch (err) {
    console.error("DELETE /categories/:id error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

module.exports = router;