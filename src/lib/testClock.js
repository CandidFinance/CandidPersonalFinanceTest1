// Loaded before the tests (npm test): they run as if today were 8 October
// 2026, in the 2026/27 tax year, so results that follow the tax year (rates
// and limits in tax.js) don't change under them on 6 April. A test of a later
// year says which year it means (inputsTaxYear, or the year passed in).
const TODAY = Date.parse("2026-10-08T12:00:00Z");
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [TODAY])); }
  static now() { return TODAY; }
};
