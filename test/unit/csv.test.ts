import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("splits plain rows and fields", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas, doubled quotes and line breaks", () => {
    const text = 'title,review\n"Dune, #1","He said ""spice""\nand left"\n';
    expect(parseCsv(text)).toEqual([
      ["title", "review"],
      ["Dune, #1", 'He said "spice"\nand left'],
    ]);
  });

  it("accepts Windows line endings, a byte-order mark and skips blank lines", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("keeps empty fields", () => {
    expect(parseCsv("a,,c\n")).toEqual([["a", "", "c"]]);
  });
});

describe("csvRecords", () => {
  it("keys rows by header name and trims values", () => {
    const { headers, records } = csvRecords("Title , Author\n Dune , Frank Herbert\nShort\n");
    expect(headers).toEqual(["Title", "Author"]);
    expect(records[0]).toEqual({ Title: "Dune", Author: "Frank Herbert" });
    expect(records[1]).toEqual({ Title: "Short", Author: "" });
  });
});
