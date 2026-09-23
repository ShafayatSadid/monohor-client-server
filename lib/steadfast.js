// lib/steadfast.js
const STEADFAST_BASE_URL =
    process.env.STEADFAST_BASE_URL || "https://portal.packzy.com/api/v1";
const STEADFAST_API_KEY = process.env.STEADFAST_API_KEY;
const STEADFAST_SECRET_KEY = process.env.STEADFAST_SECRET_KEY;

function isConfigured() {
    return !!(STEADFAST_API_KEY && STEADFAST_SECRET_KEY);
}

async function createConsignment(order) {
    if (!isConfigured()) {
        return {
            ok: false,
            message: "Steadfast API credentials সেট করা নেই",
        };
    }

    // COD amount — paid হলে ০, নাহলে total
    const codAmount = order.paymentStatus === "paid" ? 0 : Number(order.total);

    const address = [
        order.customer?.address?.fullAddress,
        order.customer?.address?.area,
        order.customer?.address?.district,
        order.customer?.address?.division,
    ]
        .filter(Boolean)
        .join(", ");

    const payload = {
        invoice: order.orderNumber,
        recipient_name: order.customer?.name || "",
        recipient_phone: order.customer?.phone || "",
        recipient_address: address,
        cod_amount: codAmount,
        note: order.adminNote || "Monohor order",
    };

    try {
        const res = await fetch(`${STEADFAST_BASE_URL}/create_order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Api-Key": STEADFAST_API_KEY,
                "Secret-Key": STEADFAST_SECRET_KEY,
            },
            body: JSON.stringify(payload),
        });

        let data;
        try {
            data = await res.json();
        } catch {
            data = {};
        }

        if (!res.ok || !data?.consignment) {
            return {
                ok: false,
                message:
                    data?.message ||
                    `Steadfast API error (HTTP ${res.status})`,
                raw: data,
            };
        }

        return { ok: true, consignment: data.consignment };
    } catch (err) {
        console.error("Steadfast createConsignment error:", err);
        return {
            ok: false,
            message: "Steadfast API-তে সংযোগ করা যায়নি",
        };
    }
}

module.exports = { isConfigured, createConsignment };