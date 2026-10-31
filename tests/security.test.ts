import { scryptSync } from "node:crypto";
import { hashPassword, verifyPassword, passwordNeedsRehash } from "../lib/password";
import assert from "node:assert/strict";
import test from "node:test";
import { readJsonObject, readRequestText, RequestBodyError } from "../lib/security/request";
import { contentSecurityPolicy, browserSecurityHeaders } from "../lib/security/headers";
import { escapeCsvCell } from "../features/pm/csv";

function streamed(chunks: string[], headers: Record<string, string> = {}) {
  const encoded = chunks.map(value => new TextEncoder().encode(value));
  return new Request("http://localhost/api/test", { method: "POST", headers, body: new ReadableStream({ start(controller) { for (const chunk of encoded) controller.enqueue(chunk); controller.close(); } }), duplex: "half" } as RequestInit);
}
test("request limits stop streamed and under-declared bodies, counting bytes", async () => {
  for (const headers of [{}, { "content-length": "1" }] as Record<string, string>[]) await assert.rejects(readRequestText(streamed(["1234", "5678"], headers), 6), error => error instanceof RequestBodyError && error.status === 413);
  await assert.rejects(readRequestText(streamed(["éé"], {}), 3), error => error instanceof RequestBodyError && error.status === 413);
  assert.equal(await readRequestText(streamed(["12", "34"]), 4), "1234");
});
test("JSON input rejects malformed, non-object and deeply nested payloads", async () => {
  for (const input of ["null", "[]", "{", '{"a":'.repeat(35) + "1" + "}".repeat(35)]) await assert.rejects(readJsonObject(streamed([input])), error => error instanceof RequestBodyError && error.status === 400);
  assert.deepEqual(await readJsonObject(streamed(['{"notes":"Field service"}'])), { notes: "Field service" });
});
test("CSV cells neutralize formulas and preserve ordinary quotes, commas and newlines", () => {
  for (const value of ["=1+1", "+1+1", "-1+1", "@SUM(1,1)", "  =1+1", "\tvalue", "\n=1+1", "\rvalue"]) assert.equal(escapeCsvCell(value), `"'${value}"`);
  assert.equal(escapeCsvCell('Lab "A", floor 2'), '"Lab ""A"", floor 2"');
  assert.equal(escapeCsvCell("Visit\nnotes"), '"Visit\nnotes"');
  assert.equal(escapeCsvCell("PM-1234"), '"PM-1234"');
});
test("production CSP uses nonces and blocks third-party connections, framing and inline scripts", () => {
  const policy = contentSecurityPolicy("test-nonce", false, true);
  const scripts = policy.split("; ").find(value => value.startsWith("script-src"))!;
  assert.match(scripts, /'nonce-test-nonce'/);
  assert.ok(!scripts.includes("'unsafe-inline'") && !scripts.includes("'unsafe-eval'"));
  assert.match(policy, /connect-src 'self';/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /upgrade-insecure-requests/);
  assert.ok(!contentSecurityPolicy("nonce", false, false).includes("upgrade-insecure-requests"));
  assert.match(contentSecurityPolicy("nonce", true, false), /'unsafe-eval'/);
  assert.ok(browserSecurityHeaders(true).some(header => header.key === "Strict-Transport-Security"));
  assert.ok(browserSecurityHeaders(false).some(header => header.key === "Referrer-Policy" && header.value === "same-origin"));
});

test("password work factors are explicit, legacy hashes remain compatible, corrupt hashes fail safely", async () => {
  const password = "legacy-test-password"; const salt = "ab".repeat(16);
  const legacy = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  assert.equal(await verifyPassword(password, legacy), true);
  assert.equal(passwordNeedsRehash(legacy), true);
  const modern = await hashPassword(password);
  assert.equal(passwordNeedsRehash(modern), false);
  assert.match(modern, /^scrypt:32768:8:3:/);
  assert.equal(await verifyPassword(password, modern), true);
  for (const malformed of ["scrypt:a:b", `scrypt:${salt}:${"z".repeat(128)}`, modern.replace("32768", "1073741824")]) assert.equal(await verifyPassword(password, malformed), false);
});
