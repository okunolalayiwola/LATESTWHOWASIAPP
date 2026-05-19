// ════════════════════════════════════════════════════════════════════
// api/stripe.js  —  Stripe Checkout session creator
// ════════════════════════════════════════════════════════════════════
// POST /api/stripe
// NOTE: All features accessible during testing — no hard gates in the app.
// This just creates the checkout; the webhook activates the plan.
//
// Env vars: STRIPE_SECRET_KEY, STRIPE_PRICE_FAMILY, STRIPE_PRICE_LEGACY

/*
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18' })

const PRICE_IDS = {
  family: process.env.STRIPE_PRICE_FAMILY,
  legacy: process.env.STRIPE_PRICE_LEGACY,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { priceId, userId, userEmail, successUrl, cancelUrl } = req.body
  if (!priceId || !PRICE_IDS[priceId]) return res.status(400).json({ error: 'Invalid price' })

  const session = await stripe.checkout.sessions.create({
    mode:                 'subscription',
    payment_method_types: ['card'],
    line_items:           [{ price: PRICE_IDS[priceId], quantity: 1 }],
    customer_email:       userEmail || undefined,
    client_reference_id:  userId   || undefined,
    metadata:             { userId: userId || '', plan: priceId },
    success_url:          successUrl || 'https://whowasi.uk/premium?status=success',
    cancel_url:           cancelUrl  || 'https://whowasi.uk/premium?status=cancelled',
    subscription_data:    { trial_period_days: 7 },
    allow_promotion_codes: true,
  })
  return res.json({ url: session.url, sessionId: session.id })
}
*/

// PLACEHOLDER — uncomment when Stripe is set up
export default async function handler(req, res) {
  return res.status(503).json({ error: 'Stripe not yet configured. Set STRIPE_SECRET_KEY, STRIPE_PRICE_FAMILY, STRIPE_PRICE_LEGACY in Vercel.' })
}
