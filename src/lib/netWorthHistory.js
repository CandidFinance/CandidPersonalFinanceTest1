// A month's net worth saved with the user's answers (d.netWorthHistory), so
// Progress can draw the line behind Now (netWorthView.js worthTimeline).
// Saved once a month, the first time the app is open that month, and never
// rewritten: { "YYYY-MM": { total, cats: { key: £ }, accts: { id: £ } } }.
// Kept in the answers, it goes wherever they do (this device, and the
// account for anyone signed in). Pure, unit tested in netWorthHistory.test.js.

// "YYYY-MM", as netWorthView.js keys months.
const monthKey = t => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;

// The history with this month added, or null where there's nothing to add:
// this month already saved, or nothing entered yet (a month of £0 isn't
// worth drawing).
export function withThisMonth(history, worth, now = new Date()) {
  const key = monthKey(now);
  const prev = history && typeof history === "object" && !Array.isArray(history) ? history : {};
  if (prev[key]) return null;
  if (!worth.assetsTotal && !worth.debtsTotal) return null;
  const cats = {}, accts = {};
  for (const c of [...worth.assets, ...worth.debts]) {
    if (c.value) cats[c.key] = c.value;
    for (const a of c.accounts) if (a.value) accts[a.id] = a.value;
  }
  return { ...prev, [key]: { total: worth.netWorth, cats, accts } };
}

// Two devices' histories put together on signing in (mergeAnswers.js):
// every month either has, the account's where both have the same month.
export function mergeHistory(account, device) {
  const ok = h => h && typeof h === "object" && !Array.isArray(h);
  if (!ok(device)) return account;
  if (!ok(account)) return device;
  return { ...device, ...account };
}
