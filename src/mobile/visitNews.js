import { useSyncExternalStore } from "react";
import posthog from "posthog-js";
import { visitSnapshot, sinceLastVisit } from "../lib/sinceLastVisit.js";
import { reportStorageFailure } from "../lib/storage.js";

// What's new since the last visit, shared by Home's "Since your last visit"
// (SinceLastVisit.jsx) and the red badges on Cash (NewBadge.jsx).
//
// The last visit: a snapshot on this device (candid_last_visit), read once
// a tab session and held in sessionStorage, so a reload still compares
// with the visit before rather than the one just recorded. This visit's
// snapshot is recorded once the rates are in (CandidApp), once a session.
//
// Cash news: when best rates have moved for them since the last visit (the
// "Rates", "Rate cut" and "Bonus rate" lines), a count on this device
// (candid_cash_news) badges the Modules tab, the Cash tile and Home's Cash
// row until they open Cash, and the savings tile in Cash until they open
// that. Unread news from an earlier visit adds to the count, like an inbox.
// All of it cleared on signing out (entitlement.js).
const LAST = "candid_last_visit";
const NEWS = "candid_cash_news";
const SESSION_PREV = "candid_last_visit_prev";
const SESSION_RECORDED = "candid_visit_recorded";
const SESSION_CLOSED = "candid_since_closed";

let prev;
let news;
let recorded = false;
const listeners = new Set();
const notify = () => listeners.forEach(f => f());

const readJson = (store, key) => JSON.parse(store.getItem(key));

// The last visit's snapshot, or null on the first.
export function lastVisit() {
  if (prev !== undefined) return prev;
  try {
    const held = sessionStorage.getItem(SESSION_PREV);
    if (held != null) prev = JSON.parse(held);
    else {
      prev = readJson(localStorage, LAST) || null;
      sessionStorage.setItem(SESSION_PREV, JSON.stringify(prev));
    }
  } catch (e) { reportStorageFailure("read_last_visit", e); prev = prev ?? null; }
  return prev;
}

// Records this visit (once a session, once `rows` are in) and adds any
// rate changes since the last to the Cash news.
export function recordVisit(d, m, rows) {
  if (!rows || recorded) return;
  recorded = true;
  try {
    if (sessionStorage.getItem(SESSION_RECORDED)) return;
    sessionStorage.setItem(SESSION_RECORDED, "1");
  } catch (e) { reportStorageFailure("record_visit", e); }
  const since = sinceLastVisit(lastVisit(), d, m, rows);
  try {
    if (since?.rateCount) {
      const was = cashNews();
      writeNews({ count: (was?.count || 0) + since.rateCount, opened: false });
    }
    localStorage.setItem(LAST, JSON.stringify(visitSnapshot(d, m, rows)));
  } catch (e) { reportStorageFailure("save_last_visit", e); }
}

export function cashNews() {
  if (news === undefined) {
    try { news = readJson(localStorage, NEWS) || null; }
    catch (e) { reportStorageFailure("read_cash_news", e); news = null; }
  }
  return news;
}

function writeNews(next) {
  news = next;
  try { next ? localStorage.setItem(NEWS, JSON.stringify(next)) : localStorage.removeItem(NEWS); }
  catch (e) { reportStorageFailure("save_cash_news", e); }
  notify();
}

// Opening Cash: the badges outside it go; the savings tile's stays.
export function markCashOpened() {
  const n = cashNews();
  if (!n || n.opened) return;
  posthog.capture("cash_news_opened", { count: n.count });
  writeNews({ ...n, opened: true });
}

// Opening the savings tile in Cash: all read.
export function markCashSeen() {
  if (cashNews()) writeNews(null);
}

const subscribe = f => { listeners.add(f); return () => listeners.delete(f); };
export const useCashNews = () => useSyncExternalStore(subscribe, cashNews);

// Home's strip, closed for the rest of the session.
export function sinceClosed() {
  try { return !!sessionStorage.getItem(SESSION_CLOSED); } catch { return false; }
}
export function closeSince() {
  try { sessionStorage.setItem(SESSION_CLOSED, "1"); } catch (e) { reportStorageFailure("close_since", e); }
}
