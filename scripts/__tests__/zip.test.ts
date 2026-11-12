/**
 * The deterministic zip — round trip, determinism, STORE vs DEFLATE, and a big entry (#899).
 *
 * The property that matters is the second one: **the same entries packed twice are the same
 * bytes**. A package's identity is its sha256, so a writer that stamps a clock or iterates a
 * map in insertion order makes two packs of one tree differ — and a hash that moves is a
 * finding, not a flaky test. The other three cases exist because each one is a place a writer
 * silently gets the format wrong: a small payload that deflate *grows*, an entry past 64 KB
 * (the first place a naive size field overflows), and a CRC that nobody checks.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { describe, it } from "node:test";

import { crc32, unzipEntries, zipEntries, zipSummary } from "../zip-bridge";

const text = (value: string): Buffer => Buffer.from(value, "utf8");

describe("zip — round trip", () => {
  it("returns every entry's bytes, in sorted order", () => {
    const entries = [
      { name: "b.txt", data: text("second\n") },
      { name: "a/b.bin", data: randomBytes(1024) },
      { name: "media/x.png", data: text("not really a png\n") },
    ];
    const back = unzipEntries(zipEntries(entries));

    assert.deepEqual(
      back.map((entry) => entry.name),
      ["a/b.bin", "b.txt", "media/x.png"],
      "entries are sorted by name, not by the order they were handed over",
    );
    for (const entry of back) {
      const source = entries.find((candidate) => candidate.name === entry.name);
      assert.ok(source !== undefined);
      assert.deepEqual(entry.data, source.data, `"${entry.name}" must round-trip byte for byte`);
    }
  });

  it("survives an empty file and a zero-length archive of one", () => {
    const back = unzipEntries(zipEntries([{ name: "empty.txt", data: Buffer.alloc(0) }]));
    assert.equal(back.length, 1);
    assert.equal(back[0].data.length, 0);
  });
});

describe("zip — determinism (the whole point)", () => {
  const entries = [
    { name: "b.json", data: text(`${"x".repeat(500)}\n`) },
    { name: "a.json", data: text(`${"y".repeat(50)}\n`) },
    { name: "media/z.bin", data: randomBytes(2048) },
  ];

  it("packs the same entries to the same bytes twice", () => {
    assert.deepEqual(zipEntries(entries), zipEntries(entries));
  });

  it("packs the same entries to the same bytes whatever order they arrive in", () => {
    assert.deepEqual(zipEntries(entries), zipEntries([...entries].reverse()));
  });

  it("stamps one fixed timestamp, so no clock reading can leak into the hash", () => {
    const archive = zipEntries([{ name: "a.txt", data: text("x") }]);
    // Local header: 4 signature, 2 version, 2 flags, 2 method, 2 time, 2 date.
    assert.equal(archive.readUInt16LE(10), 0, "modification time is the DOS zero");
    assert.equal(archive.readUInt16LE(12), ((2020 - 1980) << 9) | (1 << 5) | 1, "the fixed date");
  });
});

describe("zip — STORE when deflate would grow the file", () => {
  it("stores an incompressible entry instead of deflating it", () => {
    const data = randomBytes(64 * 1024);
    const archive = zipEntries([{ name: "random.bin", data }]);
    // Local header: method at byte 8. 0 = STORE, 8 = DEFLATE.
    assert.equal(archive.readUInt16LE(8), 0, "64 KB of entropy must be stored, not inflated");
    assert.ok(
      archive.length < data.length + 200,
      `a stored entry costs its own bytes plus the headers (archive ${archive.length}, data ${data.length})`,
    );
    assert.deepEqual(unzipEntries(archive)[0].data, data);
  });

  it("deflates a compressible entry, because that is smaller", () => {
    const data = text("alignsynch ".repeat(20_000));
    const archive = zipEntries([{ name: "big.txt", data }]);
    assert.equal(archive.readUInt16LE(8), 8, "a repeated body compresses");
    assert.ok(archive.length < data.length / 4, "and the archive is much smaller than the input");
    assert.deepEqual(unzipEntries(archive)[0].data, data);
  });
});

describe("zip — an entry past 64 KB", () => {
  it("round-trips 200 KB across the 16-bit size boundary", () => {
    const data = Buffer.alloc(200 * 1024);
    for (let index = 0; index < data.length; index += 1) data[index] = index % 251;
    const archive = zipEntries([
      { name: "small.txt", data: text("tiny\n") },
      { name: "large.bin", data },
    ]);
    assert.ok(archive.length > 0);
    const back = unzipEntries(archive);
    assert.deepEqual(
      back.map((entry) => entry.name),
      ["large.bin", "small.txt"],
    );
    assert.deepEqual(back[0].data, data, "past 64 KB the sizes come from the 32-bit fields");
  });

  it("stores a 200 KB incompressible entry, and still reads it back", () => {
    const data = randomBytes(200 * 1024);
    const archive = zipEntries([{ name: "big-random.bin", data }]);
    assert.equal(archive.readUInt16LE(8), 0, "entropy stays stored even past 64 KB");
    assert.deepEqual(unzipEntries(archive)[0].data, data);
  });
});

describe("zip — refusals, so a bad archive fails here and not at an install", () => {
  it("refuses a directory entry", () => {
    assert.throws(() => zipEntries([{ name: "media/", data: Buffer.alloc(0) }]), /directory entry/);
  });

  it("refuses one name twice", () => {
    assert.throws(
      () =>
        zipEntries([
          { name: "a.txt", data: text("one") },
          { name: "a.txt", data: text("two") },
        ]),
      /in the archive twice/,
    );
  });

  it("refuses a backslash path", () => {
    assert.throws(() => zipEntries([{ name: "a\\b.txt", data: text("x") }]), /backslash/);
  });

  it("fails a CRC32 check when a stored byte is flipped", () => {
    const archive = zipEntries([{ name: "a.txt", data: text("hello world\n") }]);
    const at = archive.indexOf(Buffer.from("hello world"));
    assert.ok(at > 0, "the case must find the payload it is corrupting");
    archive[at] = "j".charCodeAt(0);
    assert.throws(() => unzipEntries(archive), /CRC32/);
  });

  it("fails a truncated archive", () => {
    const archive = zipEntries([{ name: "a.txt", data: text("hello") }]);
    assert.throws(() => unzipEntries(archive.subarray(0, 10)), /end-of-central-directory/);
  });

  it("computes the CRC32 the zip specification names", () => {
    // The standard check value: "123456789" is 0xCBF43926 in IEEE 802.3.
    assert.equal(crc32(text("123456789")), 0xcbf43926);
    assert.equal(crc32(Buffer.alloc(0)), 0);
  });

  it("reports the entry count and the archive size", () => {
    const archive = zipEntries([
      { name: "a.txt", data: text("a") },
      { name: "b.txt", data: text("b") },
    ]);
    assert.deepEqual(zipSummary(archive), { entries: 2, bytes: archive.length });
  });

  it("is readable by a standard inflater (raw deflate, no zlib wrapper)", () => {
    const data = text("raw deflate ".repeat(100));
    const archive = zipEntries([{ name: "a.txt", data }]);
    // The deflate stream must be wrapped the way zip expects: raw, no zlib header. A zlib
    // header would make every real unzip tool refuse the entry.
    const deflated = deflateRawSync(data);
    assert.equal(archive.subarray(30 + 5, 30 + 5 + deflated.length).equals(deflated), true);
  });
});
