import assert from "node:assert/strict";
import { getDb } from "../db";
import { pmRecords, users } from "../db/schema";
import { createSession } from "../lib/auth";
import { hashPassword } from "../lib/password";
import { GET as analytics } from "../app/api/pm-analytics/route";
import { GET as records } from "../app/api/pm-analytics/records/route";

export async function testTopEquipment() {
  const db = getDb();
  const passwordHash = await hashPassword("ranking-test-password");
  await db.insert(users).values([
    { id: "ranking-tech", email: "ranking@example.test", displayName: "Ranking QA", passwordHash },
    { id: "ranking-other", email: "ranking-other@example.test", displayName: "Other QA", passwordHash },
  ]);
  const token = await createSession("ranking-tech");
  const request = (extra = "") => {
    const params = new URLSearchParams("days=30&end=2026-10-31");
    new URLSearchParams(extra.replace(/^&/, "")).forEach((value, key) => params.set(key, value));
    return new Request(`http://localhost:3000/api/pm-analytics?${params}`, { headers: { cookie: `cryopm_session=${token}` } });
  };
  const groups = [
    { brand: "mve" as const, modelFamily: "HEco 800 Series", model: "815P-190", count: 5 },
    { brand: "taylor" as const, modelFamily: "K-Series", model: "24K", count: 3 },
    { brand: "mve" as const, modelFamily: "High Efficiency 800", model: "815P-190", count: 2 },
    { brand: "mve" as const, modelFamily: "HEco 1500 Series", model: "1536P-190", count: 1 },
  ];
  let serial = 0;
  async function insert(group: typeof groups[number], extra: Record<string, unknown> = {}) {
    for (let i = 0; i < group.count; i++) {
      serial++;
      await db.insert(pmRecords).values({ id: `ranking-${serial}`, recordNumber: `PM-RANKING-${serial}`, ownerSubject: "ranking-tech", createdBy: "ranking-tech", brand: group.brand, modelFamily: group.modelFamily, model: group.model, performedOn: "2026-10-10", status: i % 2 ? "completed" : "draft", payloadJson: "{}", ...extra });
    }
  }
  for (const group of groups) await insert(group);
  await insert({ ...groups[1], count: 1 }, { ownerSubject: "ranking-other" }); // Creator keeps read access after assignment.
  await insert({ ...groups[3], count: 6 }, { ownerSubject: "ranking-other", createdBy: "ranking-other" });
  await insert({ ...groups[3], count: 6 }, { status: "archived" });
  await insert({ ...groups[3], count: 6 }, { deletedAt: new Date().toISOString() });
  await insert({ ...groups[3], count: 6 }, { performedOn: "2026-08-01" });
  const response = await analytics(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.total, 12);
  assert.deepEqual(data.topModels.map((item: { model: string; family: string; count: number }) => [item.family, item.model, item.count]), [
    ["HEco 800 Series", "815P-190", 5], ["K-Series", "24K", 4], ["High Efficiency 800", "815P-190", 2],
  ]);
  for (const item of data.topModels) {
    const detail = await (await records(request(`&kind=model&value=${encodeURIComponent(item.key)}`))).json();
    assert.equal(detail.total, item.count);
    assert.ok(detail.records.every((record: { modelFamily: string; model: string }) => record.modelFamily === item.family && record.model === item.model));
  }
  const mve = await (await analytics(request("&brand=mve"))).json();
  assert.deepEqual(mve.topModels.map((item: { count: number }) => item.count), [5, 2, 1]);
  const empty = await (await analytics(request("&days=7"))).json();
  assert.deepEqual(empty.topModels, []);
  for (const value of ["not-json", JSON.stringify(["mve", "HEco 800 Series"]), JSON.stringify(["mve", "HEco 800 Series", 815]), JSON.stringify(["mve", "HEco 800 Series", "815P-190", "extra"])]) {
    assert.equal((await records(request(`&kind=model&value=${encodeURIComponent(value)}`))).status, 400);
  }
  assert.equal((await (await records(request(`&brand=taylor&kind=model&value=${encodeURIComponent(data.topModels[0].key)}`))).json()).total, 0);
}
