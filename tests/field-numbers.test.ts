import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDecimal, inOpenRange } from "../features/pm/helpers";

test("field readings accept decimal commas without changing their magnitude", () => {
  assert.equal(normalizeDecimal("3,2", false), "3.2");
  assert.equal(normalizeDecimal("24,6", true), "24.6");
  assert.equal(normalizeDecimal("−180,5", true), "-180.5");
  assert.equal(normalizeDecimal("-180.5", true), "-180.5");
  assert.equal(normalizeDecimal("−", true), "-");
  assert.equal(normalizeDecimal("-3,2", false), "3.2");
  assert.equal(inOpenRange(normalizeDecimal("62,1", false), 62, 74), true);
  assert.equal(inOpenRange(normalizeDecimal("62,0", false), 62, 74), false);
});
