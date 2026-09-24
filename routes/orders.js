// routes/orders.js
const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../lib/db");
const {
    getDeliveryCharge,
    generateOrderNumber,
} = require("../lib/orderHelpers");
const { verifyToken, requireAdmin } = require("../middleware/auth");
const { createConsignment } = require("../lib/steadfast");
const { sendOrderConfirmationEmail } = require("../lib/email");

const router = express.Router();

// Valid order statuses
const ORDER_STATUSES = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
];

// ─────────────────────────────────────────────────────────────
// POST /orders — Create order (guest or logged-in)
// SECURITY: server-side price lookup + calculation
// ─────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
    try {
        const { items, customer, paymentMethod = "COD", note } = req.body || {};

        // ─── 1. Validate shape ───
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).send({ message: "কার্ট খালি" });
        }

        if (
            !customer ||
            !customer.name?.trim() ||
            !customer.phone?.trim() ||
            !customer.address
        ) {
            return res.status(400).send({
                message: "নাম, ফোন ও ঠিকানা দিতে হবে",
            });
        }

        const phone = String(customer.phone).trim();
        if (!/^01[3-9]\d{8}$/.test(phone)) {
            return res
                .status(400)
                .send({ message: "সঠিক ফোন নাম্বার দিন (১১ ডিজিট)" });
        }

        const allowedMethods = ["COD", "bkash", "nagad"];
        if (!allowedMethods.includes(paymentMethod)) {
            return res
                .status(400)
                .send({ message: "অবৈধ পেমেন্ট পদ্ধতি" });
        }

        if (items.length > 30) {
            return res
                .status(400)
                .send({ message: "একবারে সর্বোচ্চ ৩০টি পণ্য" });
        }

        // ─── 2. Server-side price lookup + stock validation ───
        const productsCollection = await getCollection("products");
        const orderItems = [];
        let subtotal = 0;

        for (const item of items) {
            const slug = String(item?.slug || "").trim();
            const qty = Number(item?.qty);

            if (!slug || !Number.isInteger(qty) || qty < 1 || qty > 100) {
                return res
                    .status(400)
                    .send({ message: "প্রতিটি পণ্যের তথ্য সঠিক নয়" });
            }

            const product = await productsCollection.findOne({ slug });
            if (!product) {
                return res.status(400).send({
                    message: `পণ্য পাওয়া যায়নি: ${slug}`,
                });
            }

            if (Number(product.stock) < qty) {
                return res.status(400).send({
                    message: `"${product.name}" এর স্টক অপর্যাপ্ত (মাত্র ${product.stock}টি আছে)`,
                });
            }

            // Price snapshot — server-এর DB থেকে
            const price = Number(product.price);
            const lineTotal = price * qty;
            subtotal += lineTotal;

            orderItems.push({
                productId: product._id,
                slug: product.slug,
                name: product.name,
                price,
                qty,
                lineTotal,
                image: product.images?.[0] || null,
            });
        }

        // ─── 3. Delivery charge (server-calculated, flat) ───
        const deliveryCharge = getDeliveryCharge();

        // ─── 4. Total ───
        const total = subtotal + deliveryCharge;

        // ─── 5. Order number ───
        const orderNumber = await generateOrderNumber();

        // ─── 6. Build order document ───
        const newOrder = {
            orderNumber,
            user: null,
            customer: {
                name: String(customer.name).trim(),
                phone,
                email: customer.email ? String(customer.email).trim() : null,
                address: {
                    division: customer.address.division || "",
                    district: customer.address.district || "",
                    area: customer.address.area || "",
                    fullAddress: String(
                        customer.address.fullAddress || ""
                    ).trim(),
                    
                },
            },
            items: orderItems,
            subtotal,
            deliveryCharge,
            discount: 0,
            couponCode: null,
            total,
            paymentMethod,
            paymentStatus: paymentMethod === "COD" ? "cod-pending" : "unpaid",
            orderStatus: "pending",
            adminNote: note ? String(note).slice(0, 500) : "",
            steadfast: {
                consignmentId: null,
                trackingCode: null,
                sentAt: null,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // ─── 7. Insert order ───
        const ordersCollection = await getCollection("orders");
        const result = await ordersCollection.insertOne(newOrder);

        // ─── 8. Decrement stock (best-effort) ───
        // NOTE: race condition-এ negative হতে পারে — admin panel থেকে fix করা যাবে
        for (const item of orderItems) {
            await productsCollection.updateOne(
                { _id: item.productId },
                { $inc: { stock: -item.qty } }
            );
        }

        // ─── 9. Response ───
        res.status(201).send({
            message: "অর্ডার সফলভাবে জমা হয়েছে",
            orderId: result.insertedId,
            orderNumber,
            subtotal,
            deliveryCharge,
            total,
            paymentMethod,
            orderStatus: "pending",
        });
    } catch (err) {
        console.error("POST /orders error:", err);
        res.status(500).send({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /orders — List all orders (admin only — TODO middleware)
// Query: ?status=pending&phone=017...&page=1&limit=20
// ─────────────────────────────────────────────────────────────
router.get("/", verifyToken, requireAdmin, async (req, res) => {
    try {
        const { status, phone, page, limit } = req.query;

        const query = {};
        if (status) {
            if (!ORDER_STATUSES.includes(status)) {
                return res
                    .status(400)
                    .send({ message: "Invalid status filter" });
            }
            query.orderStatus = status;
        }
        if (phone) query["customer.phone"] = String(phone);

        const ordersCollection = await getCollection("orders");

        if (page || limit) {
            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(
                100,
                Math.max(1, parseInt(limit) || 20)
            );
            const skip = (pageNum - 1) * limitNum;

            const [orders, total] = await Promise.all([
                ordersCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .toArray(),
                ordersCollection.countDocuments(query),
            ]);

            return res.send({
                orders,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1,
            });
        }

        const orders = await ordersCollection
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();
        res.send(orders);
    } catch (err) {
        console.error("GET /orders error:", err);
        res.status(500).send({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /orders/track/:orderNumber — Guest order lookup by number
// ─────────────────────────────────────────────────────────────
router.get("/track/:orderNumber", async (req, res) => {
    try {
        const orderNumber = String(req.params.orderNumber).trim();
        const ordersCollection = await getCollection("orders");
        const order = await ordersCollection.findOne({ orderNumber });

        if (!order) {
            return res.status(404).send({ message: "অর্ডার পাওয়া যায়নি" });
        }

        // Only safe fields for guest lookup
        res.send({
            orderNumber: order.orderNumber,
            orderStatus: order.orderStatus,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            total: order.total,
            deliveryCharge: order.deliveryCharge,
            subtotal: order.subtotal,
            customer: {
                name: order.customer.name,
                phone: order.customer.phone,
            },
            items: order.items,
            steadfast: order.steadfast,
            createdAt: order.createdAt,
        });
    } catch (err) {
        console.error("GET /orders/track error:", err);
        res.status(500).send({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /orders/:id — Single order (admin only — TODO middleware)
// ─────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid id" });
        }

        const ordersCollection = await getCollection("orders");
        const order = await ordersCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!order) {
            return res.status(404).send({ message: "Order not found" });
        }

        res.send(order);
    } catch (err) {
        console.error("GET /orders/:id error:", err);
        res.status(500).send({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────────────────────
// PATCH /orders/:id — Update status/note/steadfast (admin only)
// ─────────────────────────────────────────────────────────────
router.patch("/:id", verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid id" });
        }

        const {
            orderStatus,
            paymentStatus,
            adminNote,
            steadfast,
        } = req.body || {};

        const updateDoc = {};

        if (orderStatus !== undefined) {
            if (!ORDER_STATUSES.includes(orderStatus)) {
                return res.status(400).send({
                    message: `Invalid orderStatus. Allowed: ${ORDER_STATUSES.join(", ")}`,
                });
            }
            updateDoc.orderStatus = orderStatus;
        }

        if (paymentStatus !== undefined) {
            const allowed = ["unpaid", "paid", "cod-pending", "failed"];
            if (!allowed.includes(paymentStatus)) {
                return res.status(400).send({
                    message: "Invalid paymentStatus",
                });
            }
            updateDoc.paymentStatus = paymentStatus;
        }

        if (adminNote !== undefined) {
            updateDoc.adminNote = String(adminNote).slice(0, 1000);
        }

        if (steadfast !== undefined) {
            updateDoc.steadfast = {
                consignmentId: steadfast?.consignmentId || null,
                trackingCode: steadfast?.trackingCode || null,
                sentAt: steadfast?.sentAt || new Date(),
            };
        }

        if (Object.keys(updateDoc).length === 0) {
            return res
                .status(400)
                .send({ message: "No valid fields to update" });
        }

        updateDoc.updatedAt = new Date();

        const ordersCollection = await getCollection("orders");

        // ─── পুরোনো order state নিয়ে আসি (email trigger check-এর জন্য) ───
        const existingOrder = await ordersCollection.findOne({
            _id: new ObjectId(id),
        });
        if (!existingOrder) {
            return res.status(404).send({ message: "Order not found" });
        }

        await ordersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateDoc }
        );

        let updated = await ordersCollection.findOne({
            _id: new ObjectId(id),
        });

        // ─── Email trigger logic ───
        // শুধু প্রথমবার pending → confirmed হলে email পাঠাব
        const isFirstConfirmation =
            existingOrder.orderStatus !== "confirmed" &&
            updateDoc.orderStatus === "confirmed" &&
            !existingOrder.emailSent;

        let emailResult = null;

        if (isFirstConfirmation) {
            if (updated.customer?.email) {
                emailResult = await sendOrderConfirmationEmail(updated);

                if (emailResult.ok) {
                    await ordersCollection.updateOne(
                        { _id: new ObjectId(id) },
                        {
                            $set: {
                                emailSent: true,
                                emailSentAt: new Date(),
                            },
                        }
                    );
                    updated = await ordersCollection.findOne({
                        _id: new ObjectId(id),
                    });
                }
            } else {
                emailResult = {
                    ok: false,
                    message: "গ্রাহকের ইমেইল নেই",
                };
            }
        }

        res.send({
            message: "Order updated",
            order: updated,
            emailResult,
        });
    } catch (err) {
        console.error("PATCH /orders/:id error:", err);
        res.status(500).send({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /orders/:id/send-steadfast — Admin: Steadfast-এ পাঠান
// ─────────────────────────────────────────────────────────────
router.post(
    "/:id/send-steadfast",
    verifyToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid id" });
            }

            const ordersCollection = await getCollection("orders");
            const order = await ordersCollection.findOne({
                _id: new ObjectId(id),
            });

            if (!order) {
                return res.status(404).send({ message: "Order not found" });
            }

            // Duplicate protection
            if (order.steadfast?.consignmentId) {
                return res.status(409).send({
                    message: "এই অর্ডার আগেই Steadfast-এ পাঠানো হয়েছে",
                    steadfast: order.steadfast,
                });
            }

            if (order.orderStatus === "cancelled") {
                return res.status(400).send({
                    message: "বাতিল অর্ডার Steadfast-এ পাঠানো যাবে না",
                });
            }

            // Send to Steadfast
            const result = await createConsignment(order);

            if (!result.ok) {
                return res.status(502).send({
                    message:
                        result.message ||
                        "Steadfast-এ পাঠানো যায়নি",
                });
            }

            const c = result.consignment;

            const updateDoc = {
                steadfast: {
                    consignmentId: c.consignment_id,
                    trackingCode: c.tracking_code,
                    status: c.status || "in_review",
                    sentAt: new Date(),
                },
                orderStatus: "shipped",
                updatedAt: new Date(),
            };

            await ordersCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updateDoc }
            );

            const updated = await ordersCollection.findOne({
                _id: new ObjectId(id),
            });

            res.send({
                message: "Steadfast-এ সফলভাবে পাঠানো হয়েছে",
                order: updated,
            });
        } catch (err) {
            console.error("POST /orders/:id/send-steadfast error:", err);
            res.status(500).send({ message: "Server error" });
        }
    }
);
// ─────────────────────────────────────────────────────────────
// GET /orders/config/delivery-zones — Frontend form-এর জন্য
// ─────────────────────────────────────────────────────────────
router.get("/config/delivery-zones", (req, res) => {
    res.send([
        { value: "inside-dhaka", label: "ঢাকার ভিতরে", charge: 70 },
        { value: "dhaka-suburban", label: "ঢাকার উপশহর", charge: 100 },
        { value: "outside-dhaka", label: "ঢাকার বাইরে", charge: 130 },
    ]);
});

module.exports = router;