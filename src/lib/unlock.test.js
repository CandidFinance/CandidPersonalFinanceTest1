import test from "node:test";
import assert from "node:assert/strict";
import { premiumOpen, onTrack } from "./unlock.js";

test("premium features: subscribers, and anyone from before the gate", () => {
  assert.equal(premiumOpen({ unlockGate: true }, false), false);
  assert.equal(premiumOpen({ unlockGate: true }, true), true);
  assert.equal(premiumOpen({}, false), true);
});

test("on track: answered, nothing to improve, and its figure not counted elsewhere", () => {
  const d = { selectedModules: ["pension"] };
  assert.equal(onTrack(d, "pension", { status: "ok" }), true);
  assert.equal(onTrack(d, "pension", { status: "critical" }), false);
  assert.equal(onTrack({ selectedModules: [] }, "pension", { status: "ok" }), false);
  assert.equal(onTrack({ selectedModules: ["kids"] }, "kids", { status: "ok", elsewhere: "taxTrap" }), false);
});
