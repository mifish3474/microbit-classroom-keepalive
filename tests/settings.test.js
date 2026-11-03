import test from "node:test";
import assert from "node:assert/strict";
import {startSettingsError} from "../extension/settings.js";

const settings = {interval: 3, tabId: 4, confirm: true, activity: true};
test("unsupported intervals explain the limit instead of reporting an action failure", () => {
  for (const interval of [1, 2, 0, 61, 3.5, NaN, undefined, "3"]) {
    assert.match(startSettingsError({...settings, interval}), /whole number from 3 to 60 minutes/);
  }
});
test("supported interval boundaries work with movement on or off", () => {
  for (const interval of [3, 4, 60]) for (const activity of [true, false]) {
    assert.equal(startSettingsError({...settings, interval, activity}), "");
  }
});
test("visible icon mode accepts one minute and retains whole-minute limits", () => {
  assert.equal(startSettingsError({...settings, mode: "marker", interval: 1}), "");
  for (const interval of [0, 0.5, 61]) assert.match(startSettingsError({...settings, mode: "marker", interval}), /1 to 60/);
  assert.notEqual(startSettingsError({...settings, mode: "unknown"}), "");
});
