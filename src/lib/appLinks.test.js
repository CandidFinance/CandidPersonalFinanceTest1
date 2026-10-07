import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanIosAppUrl, cleanAndroidAppUrl, devicePlatform, appLinkFor } from "./appLinks.js";

test("App Store links are cleaned to the app's id, and anything else is refused", () => {
  assert.equal(cleanIosAppUrl("https://apps.apple.com/gb/app/chip-savings-investing/id1196478435?mt=8&ref=abc"), "https://apps.apple.com/gb/app/id1196478435");
  assert.equal(cleanIosAppUrl("https://apps.apple.com/app/id1196478435"), "https://apps.apple.com/gb/app/id1196478435");
  assert.equal(cleanIosAppUrl(""), null);
  assert.throws(() => cleanIosAppUrl("https://apps-apple.com.evil.co/gb/app/id1196478435"));
  assert.throws(() => cleanIosAppUrl("http://apps.apple.com/gb/app/id1"));
});

test("Google Play links keep only the app id", () => {
  assert.equal(cleanAndroidAppUrl("https://play.google.com/store/apps/details?id=com.getchip.app&hl=en_GB&referrer=x"), "https://play.google.com/store/apps/details?id=com.getchip.app");
  assert.equal(cleanAndroidAppUrl("  "), null);
  assert.throws(() => cleanAndroidAppUrl("https://play.google.com.evil.co/store/apps/details?id=com.getchip.app"));
  assert.throws(() => cleanAndroidAppUrl("https://play.google.com/store/apps/details?id=not an id"));
});

test("the store link follows the device", () => {
  const links = { iosAppUrl: "ios-link", androidAppUrl: "android-link" };
  assert.equal(appLinkFor(devicePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), links), "ios-link");
  assert.equal(appLinkFor(devicePlatform("Mozilla/5.0 (Linux; Android 15; Pixel 9)"), links), "android-link");
  assert.equal(appLinkFor(devicePlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), links), null);
  assert.equal(appLinkFor("ios", { androidAppUrl: "x" }), null);
});
