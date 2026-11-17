-- Property: "Are you selling your main home to buy this one?"
-- (propertyReplacingMain, 17 Nov 2026). It lifts the 5% stamp duty surcharge
-- for someone keeping another home, so the report row records it beside
-- property_sole_property. Run by hand in the SQL editor BEFORE the
-- reportRow.js change that writes it ships: a client write naming a column
-- anon can't write is rejected whole.

alter table public.test
  add column if not exists property_replacing_main boolean;

-- Same rights as property_sole_property: insert and update, column-level.
grant insert (property_replacing_main), update (property_replacing_main) on public.test to anon;
