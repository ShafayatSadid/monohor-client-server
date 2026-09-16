// lib/orderHelpers.js
const { getCollection } = require("./db");

const DELIVERY_CHARGES = {
    "inside-dhaka": 70,
    "dhaka-suburban": 100,
    "outside-dhaka": 130,
};

function getDeliveryCharge(zone) {
    return DELIVERY_CHARGES[zone] ?? DELIVERY_CHARGES["outside-dhaka"];
}

// Atomic order number generator
// MongoDB-র findOneAndUpdate + $inc atomic — concurrent order-এও safe
async function generateOrderNumber() {
    const counters = await getCollection("counters");
    const result = await counters.findOneAndUpdate(
        { _id: "orderNumber" },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
    );
    // MongoDB driver v5+ returns doc directly; older returns { value: doc }
    const seq = result?.seq ?? result?.value?.seq ?? 1;
    return `MNH-${1000 + seq}`;
}

module.exports = {
    DELIVERY_CHARGES,
    getDeliveryCharge,
    generateOrderNumber,
};