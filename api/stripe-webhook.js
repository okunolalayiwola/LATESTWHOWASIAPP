// api/stripe-webhook.js
// Uncomment and activate once Stripe is configured at launch.
// For now this is a pass-through so Stripe doesn't error.

export default async function handler(req, res) {
  // TODO at launch: implement full webhook handler
  return res.json({ received: true })
}
