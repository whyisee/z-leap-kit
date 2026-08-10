import { describe, expect, it } from "vitest";
import { jsonChangedPaths } from "./json-diff";

describe("jsonChangedPaths", () => {
  it("reports nested object and array fields in stable order", () => {
    expect(jsonChangedPaths(
      { title: "旧", time: { start: null }, entities: [{ mention: "包子" }] },
      { title: "新", time: { start: "2026-08-10T12:00:00+08:00" }, entities: [{ mention: "肉包" }, { mention: "豆浆" }] },
    )).toEqual(["/entities/0/mention", "/entities/1", "/time/start", "/title"]);
  });

  it("treats equivalent ISO timestamps as equal", () => {
    expect(jsonChangedPaths("2026-08-10T12:00:00+08:00", "2026-08-10T04:00:00.000Z")).toEqual([]);
  });
});
