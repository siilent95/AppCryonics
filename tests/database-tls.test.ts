import assert from "node:assert/strict";
import test from "node:test";
import { rootCertificates } from "node:tls";
import { Client } from "pg";
import { databasePoolConfig } from "../db/config";

const ca = rootCertificates[0];
const encodedCa = Buffer.from(ca).toString("base64");
const url = "postgresql://runtime:example%40value@db.example.com:5432/postgres?sslmode=verify-full";

test("custom database CA survives pg URL parsing with certificate and hostname validation", () => {
  const config = databasePoolConfig(url, encodedCa);
  const client = new Client(config);
  const parameters = Reflect.get(client, "connectionParameters");
  assert.equal(parameters.ssl.ca, ca);
  assert.equal(parameters.ssl.rejectUnauthorized, true);
  assert.equal(parameters.ssl.checkServerIdentity, undefined);
  assert.equal(parameters.host, "db.example.com");
  assert.equal(parameters.password, "example@value");
  assert.equal(config.max, 10);
});

test("custom database CA rejects weakened TLS, conflicting SSL options and invalid certificates", () => {
  for (const mode of ["disable", "allow", "prefer", "require", "verify-ca"]) {
    assert.throws(() => databasePoolConfig(url.replace("verify-full", mode), encodedCa));
  }
  for (const key of ["ssl", "sslcert", "sslkey", "sslrootcert", "sslnegotiation"]) {
    assert.throws(() => databasePoolConfig(url + `&${key}=conflict`, encodedCa));
  }
  assert.throws(() => databasePoolConfig(url, Buffer.from("invalid certificate").toString("base64")));
});

test("local database configuration keeps existing behavior without a custom CA", () => {
  const local = "postgresql://local@127.0.0.1:15433/cryopm";
  assert.deepEqual(databasePoolConfig(local), { connectionString: local, max: 10 });
});
