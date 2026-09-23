// lib/orderHelpers.js
const { getCollection } = require("./db");

// সব অর্ডারে একই ডেলিভারি চার্জ (সারা দেশে)
const FLAT_DELIVERY_CHARGE = 135;

function getDeliveryCharge() {
    return FLAT_DELIVERY_CHARGE;
}

// Atomic order number generator
async function generateOrderNumber() {
    const counters = await getCollection("counters");
    const result = await counters.findOneAndUpdate(
        { _id: "orderNumber" },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
    );
    const seq = result?.seq ?? result?.value?.seq ?? 1;
    return `MNH-${1000 + seq}`;
}

module.exports = {
    FLAT_DELIVERY_CHARGE,
    getDeliveryCharge,
    generateOrderNumber,
};