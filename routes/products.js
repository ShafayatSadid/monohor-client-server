// routes/products.js
const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../lib/db");
const { verifyToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Normalize variants array — validation + auto compute
// ─────────────────────────────────────────────────────────────
function normalizeVariants(rawVariants) {
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    return { ok: true, variants: [] };
  }

  const normalized = [];

  for (let i = 0; i < rawVariants.length; i++) {
    const v = rawVariants[i] || {};
    const vSize = String(v.size || "").trim();
    const vLabel = String(v.label || vSize).trim();
    const vPrice = Number(v.price);

    if (!vSize) {
      return { ok: false, message: `ভ্যারিয়েন্ট ${i + 1}: সাইজ আবশ্যক` };
    }
    if (isNaN(vPrice) || vPrice < 0) {
      return { ok: false, message: `ভ্যারিয়েন্ট ${i + 1}: সঠিক দাম দিন` };
    }

    let vOldPrice = null;
    if (
      v.oldPrice !== undefined &&
      v.oldPrice !== "" &&
      v.oldPrice !== null
    ) {
      const op = Number(v.oldPrice);
      if (isNaN(op) || op <= vPrice) {
        return {
          ok: false,
          message: `ভ্যারিয়েন্ট ${i + 1}: পুরোনো দাম নতুন দামের চেয়ে বেশি হতে হবে`,
        };
      }
      vOldPrice = op;
    }

    normalized.push({
      id: v.id || `v${i + 1}`,
      size: vSize,
      label: vLabel,
      price: vPrice,
      oldPrice: vOldPrice,
    });
  }

  return { ok: true, variants: normalized };
}

// ─────────────────────────────────────────────────────────────
// Compute base price + base oldPrice from variants
// ─────────────────────────────────────────────────────────────
function computeBaseFromVariants(variants) {
  if (!variants || variants.length === 0) {
    return { price: null, oldPrice: null };
  }
  const minVariant = variants.reduce(
    (min, v) => (v.price < min.price ? v : min),
    variants[0]
  );
  return {
    price: minVariant.price,
    oldPrice: minVariant.oldPrice || null,
  };
}

// GET /products — filter, sort, search
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
      page,
      limit,
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

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { price: 1 };
    else if (sort === "price_desc") sortOption = { price: -1 };
    else if (sort === "popular") sortOption = { rating: -1 };
    else if (sort === "newest") sortOption = { createdAt: -1 };

    const collection = await getCollection("products");

    if (page || limit) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(48, Math.max(1, parseInt(limit) || 12));
      const skip = (pageNum - 1) * limitNum;

      const [products, total] = await Promise.all([
        collection
          .find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(limitNum)
          .toArray(),
        collection.countDocuments(query),
      ]);

      return res.send({
        products,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      });
    }

    const products = await collection.find(query).sort(sortOption).toArray();
    res.send(products);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// GET /products/:slug
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

// POST /products — create
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      slug,
      category,
      price,
      oldPrice,
      stock,
      images,
      description,
      featured,
      newArrival,
      bestSeller,
      variants,
    } = req.body;

    if (!name || !slug || !category) {
      return res.status(400).send({
        message: "name, slug, category are required",
      });
    }

    const stockNum = stock !== undefined ? Number(stock) : 0;
    if (isNaN(stockNum) || stockNum < 0) {
      return res.status(400).send({ message: "Invalid stock" });
    }

    // ─── Normalize variants ───
    const variantResult = normalizeVariants(variants);
    if (!variantResult.ok) {
      return res.status(400).send({ message: variantResult.message });
    }
    const finalVariants = variantResult.variants;
    const hasVariants = finalVariants.length > 0;

    let finalPrice = 0;
    let finalOldPrice = null;

    if (hasVariants) {
      const base = computeBaseFromVariants(finalVariants);
      finalPrice = base.price;
      finalOldPrice = base.oldPrice;
    } else {
      if (price === undefined || price === null || price === "") {
        return res.status(400).send({ message: "price required" });
      }
      const priceNum = Number(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).send({ message: "Invalid price" });
      }
      finalPrice = priceNum;

      if (oldPrice !== undefined && oldPrice !== "" && oldPrice !== null) {
        const op = Number(oldPrice);
        if (isNaN(op) || op <= finalPrice) {
          return res
            .status(400)
            .send({ message: "oldPrice must be greater than price" });
        }
        finalOldPrice = op;
      }
    }

    // Category check
    const categoryCollection = await getCollection("categories");
    const categoryExists = await categoryCollection.findOne({ slug: category });
    if (!categoryExists) {
      return res.status(400).send({ message: "Category not found" });
    }

    const collection = await getCollection("products");
    const existing = await collection.findOne({ slug });
    if (existing) {
      return res.status(409).send({ message: "Slug already exists" });
    }

    const newProduct = {
      name: String(name).trim(),
      slug: String(slug).trim(),
      category,
      price: finalPrice,
      stock: stockNum,
      images: Array.isArray(images) ? images : [],
      description: description || "",
      rating: 0,
      featured: Boolean(featured),
      newArrival: newArrival !== undefined ? Boolean(newArrival) : true,
      bestSeller: Boolean(bestSeller),
      createdAt: new Date(),
    };

    if (hasVariants) {
      newProduct.variants = finalVariants;
    }
    if (finalOldPrice !== null) {
      newProduct.oldPrice = finalOldPrice;
    }

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

// PATCH /products/:id — update
router.patch("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid id" });
    }

    const collection = await getCollection("products");
    const current = await collection.findOne({ _id: new ObjectId(id) });
    if (!current) {
      return res.status(404).send({ message: "Product not found" });
    }

    const updateDoc = {};

    // Basic fields
    if (req.body.name !== undefined)
      updateDoc.name = String(req.body.name).trim();
    if (req.body.slug !== undefined)
      updateDoc.slug = String(req.body.slug).trim();
    if (req.body.category !== undefined)
      updateDoc.category = req.body.category;
    if (req.body.description !== undefined)
      updateDoc.description = String(req.body.description || "");
    if (req.body.images !== undefined)
      updateDoc.images = Array.isArray(req.body.images) ? req.body.images : [];
    if (req.body.featured !== undefined)
      updateDoc.featured = Boolean(req.body.featured);
    if (req.body.newArrival !== undefined)
      updateDoc.newArrival = Boolean(req.body.newArrival);
    if (req.body.bestSeller !== undefined)
      updateDoc.bestSeller = Boolean(req.body.bestSeller);
    if (req.body.rating !== undefined)
      updateDoc.rating = Number(req.body.rating);

    if (req.body.stock !== undefined) {
      const s = Number(req.body.stock);
      if (isNaN(s) || s < 0)
        return res.status(400).send({ message: "Invalid stock" });
      updateDoc.stock = s;
    }

    // ─── Variants handling ───
    if (req.body.variants !== undefined) {
      const variantResult = normalizeVariants(req.body.variants);
      if (!variantResult.ok) {
        return res.status(400).send({ message: variantResult.message });
      }
      const finalVariants = variantResult.variants;

      if (finalVariants.length > 0) {
        const base = computeBaseFromVariants(finalVariants);
        updateDoc.variants = finalVariants;
        updateDoc.price = base.price;
        updateDoc.oldPrice = base.oldPrice;
      } else {
        // Variants cleared — need price from body
        const p = Number(req.body.price);
        if (isNaN(p) || p < 0) {
          return res.status(400).send({
            message: "price required when no variants",
          });
        }
        updateDoc.variants = [];
        updateDoc.price = p;

        if (req.body.oldPrice !== undefined) {
          if (req.body.oldPrice === "" || req.body.oldPrice === null) {
            updateDoc.oldPrice = null;
          } else {
            const op = Number(req.body.oldPrice);
            if (isNaN(op) || op <= p) {
              return res.status(400).send({
                message: "oldPrice must be greater than price",
              });
            }
            updateDoc.oldPrice = op;
          }
        }
      }
    } else {
      // No variants in body
      const currentHasVariants =
        Array.isArray(current.variants) && current.variants.length > 0;

      if (!currentHasVariants) {
        if (req.body.price !== undefined) {
          const p = Number(req.body.price);
          if (isNaN(p) || p < 0)
            return res.status(400).send({ message: "Invalid price" });
          updateDoc.price = p;
        }
        if (req.body.oldPrice !== undefined) {
          if (req.body.oldPrice === "" || req.body.oldPrice === null) {
            updateDoc.oldPrice = null;
          } else {
            const op = Number(req.body.oldPrice);
            const cmpPrice =
              updateDoc.price !== undefined
                ? updateDoc.price
                : Number(current.price);
            if (isNaN(op) || op <= cmpPrice) {
              return res.status(400).send({
                message: "oldPrice must be greater than price",
              });
            }
            updateDoc.oldPrice = op;
          }
        }
      }
      // If product has variants and body doesn't touch variants — ignore price/oldPrice changes
    }

    if (Object.keys(updateDoc).length === 0) {
      return res.status(400).send({ message: "No fields to update" });
    }

    // slug duplicate
    if (updateDoc.slug) {
      const duplicate = await collection.findOne({
        slug: updateDoc.slug,
        _id: { $ne: new ObjectId(id) },
      });
      if (duplicate)
        return res.status(409).send({ message: "Slug already exists" });
    }

    // category check
    if (updateDoc.category) {
      const categoryCollection = await getCollection("categories");
      const categoryExists = await categoryCollection.findOne({
        slug: updateDoc.category,
      });
      if (!categoryExists)
        return res.status(400).send({ message: "Category not found" });
    }

    await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });

    const updated = await collection.findOne({ _id: new ObjectId(id) });
    res.send({ message: "Product updated", product: updated });
  } catch (err) {
    console.error("PATCH /products/:id error:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// DELETE /products/:id
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
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