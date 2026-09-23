// routes/admin.js
const express = require("express");
const { getCollection } = require("../lib/db");
const { verifyToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /admin/stats — Dashboard stats
router.get("/stats", verifyToken, requireAdmin, async (req, res) => {
    try {
        const ordersCollection = await getCollection("orders");
        const productsCollection = await getCollection("products");
        const categoriesCollection = await getCollection("categories");

        const [
            totalOrders,
            pendingOrders,
            deliveredOrders,
            totalProducts,
            totalCategories,
            lowStockProducts,
            recentOrders,
        ] = await Promise.all([
            ordersCollection.countDocuments({}),
            ordersCollection.countDocuments({ orderStatus: "pending" }),
            ordersCollection.countDocuments({ orderStatus: "delivered" }),
            productsCollection.countDocuments({}),
            categoriesCollection.countDocuments({}),
            productsCollection
                .find({ stock: { $lte: 5 } })
                .limit(5)
                .toArray(),
            ordersCollection
                .find({})
                .sort({ createdAt: -1 })
                .limit(5)
                .toArray(),
        ]);

        // Total revenue (delivered orders only)
        const revenueResult = await ordersCollection
            .aggregate([
                { $match: { orderStatus: "delivered" } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$total" },
                    },
                },
            ])
            .toArray();

        const totalRevenue = revenueResult[0]?.total || 0;

        // Total customers (unique phone numbers)
        const customerCount = await ordersCollection
            .aggregate([
                {
                    $group: {
                        _id: "$customer.phone",
                    },
                },
                { $count: "count" },
            ])
            .toArray();

        const totalCustomers = customerCount[0]?.count || 0;

        res.send({
            totalOrders,
            pendingOrders,
            deliveredOrders,
            totalProducts,
            totalCategories,
            totalCustomers,
            totalRevenue,
            lowStockProducts,
            recentOrders,
        });
    } catch (err) {
        console.error("GET /admin/stats error:", err);
        res.status(500).send({ message: "Server error" });
    }
});

module.exports = router;