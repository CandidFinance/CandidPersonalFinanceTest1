// Signing in on a device that already has answers: the account's saved
// answers and this device's, put together, so nothing answered on either is
// lost (and so asked again). Before this, the account's copy replaced the
// device's, and anything answered here before signing in (a Pension
// walk-through, say) was gone, salary included.
//
// The account's answer wins where both have one: it's what they've kept.
// An answer only this device has is kept. The lists of what's done (which
// questions have been asked, which modules answered, unlocked or picked)
// are combined. Pure, unit tested in mergeAnswers.test.js.

const LISTS = ["askedFields", "answeredModules", "selectedModules", "unlockedModules", "interests", "financialGoals"];

const empty = v => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

export function mergeAnswers(account, device) {
  if (!device || typeof device !== "object") return account;
  if (!account || typeof account !== "object") return device;
  const out = { ...account };
  for (const [k, v] of Object.entries(device)) {
    if (LISTS.includes(k) && Array.isArray(v)) out[k] = [...new Set([...(Array.isArray(account[k]) ? account[k] : []), ...v])];
    else if (empty(account[k]) && !empty(v)) out[k] = v;
  }
  return out;
}

// The modules marked reviewed, from both.
export function mergeCompleted(account, device) {
  return [...new Set([...(Array.isArray(account) ? account : []), ...(Array.isArray(device) ? device : [])])];
}
