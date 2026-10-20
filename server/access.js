// What a `subscriptions` row gives (api/billing.js, server/referrals.js).
// Kept outside api/ so it's bundled into each function, not deployed alone.

// Statuses that keep access: past_due while Stripe retries a failed payment.
export const ACTIVE = ["active", "trialing", "past_due"];

// Plans: monthly and yearly are paid through Stripe; comp is given by hand
// (no end); referral is free months earned by inviting friends, which end
// at current_period_end. Stripe keeps a paid plan's end date itself, and
// past_due runs past it, so only a referral month is cut off here.
export const PAID_PLANS = ["monthly", "yearly"];

export function accessFor(row, now = Date.now()) {
  const ended = row?.plan === "referral" && (!row.current_period_end || new Date(row.current_period_end).getTime() <= now);
  const active = !!row && ACTIVE.includes(row.status) && !ended;
  return { active, email: row?.email || null, plan: row?.plan || null, periodEnd: row?.current_period_end || null, cancelling: !!row?.cancel_at_period_end };
}
