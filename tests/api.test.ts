import { expect, it } from "vitest";
import { GET } from "../app/api/demo/matches/route";
it("returns labeled requests, matches and explanations", async () => {
  const response = GET(); expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.demo).toBe(true); expect(body.results).toHaveLength(3);
  expect(body.results[0].matches[0].factors).toHaveLength(6);
  expect(body.results[2].matches).toEqual([]);
});
