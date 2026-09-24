// lib/email.js
const { Resend } = require("resend");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
    process.env.EMAIL_FROM || "Monohor <onboarding@resend.dev>";

const CONTACT_PHONE = "+8801718958840";
const CONTACT_PHONE_DISPLAY = "+৮৮০ ১৭১৮৯৫৮৮৪০";
const CONTACT_EMAIL = "hello.monohor@gmail.com";
const CONTACT_WHATSAPP = "8801718958840";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function isConfigured() {
    return !!resend;
}

// ─────────────────────────────────────────────────────────────
// HTML email template — Bengali
// ─────────────────────────────────────────────────────────────
function buildOrderConfirmationHTML(order) {
    const itemsHTML = (order.items || [])
        .map(
            (item) => `
                <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #E5D9C3;">
                        <div style="font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #2B1B12; font-weight: 600;">
                            ${item.name}
                        </div>
                        <div style="font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 12px; color: #7A6A5C; margin-top: 4px;">
                            ৳${item.price} × ${item.qty}
                        </div>
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #E5D9C3; text-align: right; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #2B1B12; font-weight: 700;">
                        ৳${item.lineTotal}
                    </td>
                </tr>
            `
        )
        .join("");

    return `
<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>অর্ডার কনফার্মেশন</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FBF6EE; font-family: 'Hind Siliguri', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FBF6EE; padding: 24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E5D9C3;">

                    <!-- Header -->
                    <tr>
                        <td style="background-color: #8B1E1E; padding: 32px 24px; text-align: center;">
                            <div style="font-family: 'Tiro Bangla', Georgia, serif; font-size: 32px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
                                মনোহর
                            </div>
                            <div style="font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 6px; color: #C9A24B; margin-top: 4px;">
                                MONOHOR
                            </div>
                        </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                        <td style="padding: 32px 32px 16px 32px;">
                            <h1 style="margin: 0 0 8px 0; font-family: 'Tiro Bangla', Georgia, serif; font-size: 24px; font-weight: 700; color: #2B1B12; line-height: 1.3;">
                                ধন্যবাদ, ${order.customer?.name || "প্রিয় গ্রাহক"}!
                            </h1>
                            <p style="margin: 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 15px; color: #7A6A5C; line-height: 1.6;">
                                আপনার অর্ডারটি সফলভাবে কনফার্ম হয়েছে। নিচে সংক্ষেপে অর্ডারের বিস্তারিত দেওয়া হলো।
                            </p>
                        </td>
                    </tr>

                    <!-- Order Number -->
                    <tr>
                        <td style="padding: 16px 32px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FBF6EE; border: 1px solid #E5D9C3; border-radius: 12px;">
                                <tr>
                                    <td style="padding: 16px; text-align: center;">
                                        <div style="font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #7A6A5C; margin-bottom: 6px;">
                                            অর্ডার নাম্বার
                                        </div>
                                        <div style="font-family: Arial, sans-serif; font-size: 26px; font-weight: 800; color: #8B1E1E; letter-spacing: 1px;">
                                            ${order.orderNumber}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Items -->
                    <tr>
                        <td style="padding: 16px 32px;">
                            <h2 style="margin: 0 0 12px 0; font-family: 'Tiro Bangla', Georgia, serif; font-size: 18px; font-weight: 700; color: #2B1B12; padding-bottom: 10px; border-bottom: 2px solid #E5D9C3;">
                                আপনার অর্ডার
                            </h2>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                ${itemsHTML}
                            </table>
                        </td>
                    </tr>

                    <!-- Totals -->
                    <tr>
                        <td style="padding: 16px 32px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="padding: 6px 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #7A6A5C;">
                                        সাবটোটাল
                                    </td>
                                    <td style="padding: 6px 0; text-align: right; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #2B1B12; font-weight: 600;">
                                        ৳${order.subtotal}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #7A6A5C;">
                                        ডেলিভারি চার্জ
                                    </td>
                                    <td style="padding: 6px 0; text-align: right; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #2B1B12; font-weight: 600;">
                                        ৳${order.deliveryCharge}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0 0 0; border-top: 2px solid #E5D9C3; font-family: 'Tiro Bangla', Georgia, serif; font-size: 16px; color: #2B1B12; font-weight: 700;">
                                        মোট
                                    </td>
                                    <td style="padding: 12px 0 0 0; border-top: 2px solid #E5D9C3; text-align: right; font-family: Arial, sans-serif; font-size: 20px; color: #8B1E1E; font-weight: 800;">
                                        ৳${order.total}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Next Steps Box -->
                    <tr>
                        <td style="padding: 16px 32px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FDF6E3; border-left: 4px solid #C9A24B; border-radius: 8px;">
                                <tr>
                                    <td style="padding: 20px 22px;">
                                        <p style="margin: 0 0 14px 0; font-family: 'Tiro Bangla', Georgia, serif; font-size: 15px; font-weight: 700; color: #2B1B12;">
                                            পরবর্তী ধাপ:
                                        </p>
                                        <p style="margin: 0 0 10px 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #2B1B12; line-height: 1.6;">
                                            ✅&nbsp; অর্ডার কনফার্ম সম্পন্ন
                                        </p>
                                        <p style="margin: 0 0 10px 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #2B1B12; line-height: 1.6;">
                                            📦&nbsp; শীঘ্রই Steadfast Courier-এর কাছে পণ্য হস্তান্তর করা হবে
                                        </p>
                                        <p style="margin: 0 0 10px 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #2B1B12; line-height: 1.6;">
                                            📱&nbsp; Steadfast আপনাকে SMS-এ ট্র্যাকিং লিংক পাঠাবে
                                        </p>
                                        <p style="margin: 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #2B1B12; line-height: 1.6;">
                                            🚚&nbsp; ডেলিভারি ম্যান পৌঁছালে Cash on Delivery টাকা পরিশোধ করবেন
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Important Reminder -->
                    <tr>
                        <td style="padding: 8px 32px 24px 32px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FDF2F2; border-left: 4px solid #B23A34; border-radius: 8px;">
                                <tr>
                                    <td style="padding: 16px 20px;">
                                        <p style="margin: 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 13px; color: #2B1B12; line-height: 1.6;">
                                            <strong>গুরুত্বপূর্ণ:</strong> পণ্য হাতে পাওয়ার সময় ডেলিভারি ম্যানের সামনেই খুলে যাচাই করুন। কোনো সমস্যা থাকলে সাথে সাথে যোগাযোগ করুন।
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                        <td style="padding: 0 32px;">
                            <hr style="border: none; border-top: 1px solid #E5D9C3; margin: 0;" />
                        </td>
                    </tr>

                    <!-- Footer Contact -->
                    <tr>
                        <td style="padding: 24px 32px; text-align: center;">
                            <p style="margin: 0 0 12px 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #7A6A5C;">
                                যেকোনো প্রয়োজনে যোগাযোগ করুন
                            </p>
                            <p style="margin: 0 0 8px 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #2B1B12; font-weight: 600;">
                                📞 &nbsp;<a href="tel:${CONTACT_PHONE}" style="color: #2B1B12; text-decoration: none;">${CONTACT_PHONE_DISPLAY}</a>
                            </p>
                            <p style="margin: 0 0 8px 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #2B1B12; font-weight: 600;">
                                ✉️ &nbsp;<a href="mailto:${CONTACT_EMAIL}" style="color: #2B1B12; text-decoration: none;">${CONTACT_EMAIL}</a>
                            </p>
                            <p style="margin: 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 14px; color: #2B1B12; font-weight: 600;">
                                💬 &nbsp;<a href="https://wa.me/${CONTACT_WHATSAPP}" style="color: #2B1B12; text-decoration: none;">WhatsApp: ${CONTACT_PHONE_DISPLAY}</a>
                            </p>
                        </td>
                    </tr>

                    <!-- Bottom bar -->
                    <tr>
                        <td style="background-color: #2B1B12; padding: 16px 24px; text-align: center;">
                            <p style="margin: 0; font-family: 'Hind Siliguri', Arial, sans-serif; font-size: 11px; color: #A8967F;">
                                © ${new Date().getFullYear()} মনোহর — সর্বস্বত্ব সংরক্ষিত
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

// ─────────────────────────────────────────────────────────────
// Send order confirmation email
// ─────────────────────────────────────────────────────────────
async function sendOrderConfirmationEmail(order) {
    if (!isConfigured()) {
        return {
            ok: false,
            message: "Resend API key সেট করা নেই",
        };
    }

    if (!order.customer?.email) {
        return {
            ok: false,
            message: "গ্রাহকের ইমেইল নেই",
        };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: EMAIL_FROM,
            to: [order.customer.email],
            subject: `অর্ডার ${order.orderNumber} কনফার্ম হয়েছে — মনোহর`,
            html: buildOrderConfirmationHTML(order),
        });

        if (error) {
            console.error("Resend error:", error);
            return {
                ok: false,
                message: error.message || "ইমেইল পাঠানো যায়নি",
            };
        }

        return { ok: true, id: data?.id };
    } catch (err) {
        console.error("sendOrderConfirmationEmail error:", err);
        return {
            ok: false,
            message: "ইমেইল পাঠাতে সমস্যা হয়েছে",
        };
    }
}

module.exports = {
    isConfigured,
    sendOrderConfirmationEmail,
};