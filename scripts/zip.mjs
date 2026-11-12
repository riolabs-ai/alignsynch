/**
 * A deterministic zip, in ~150 lines and no dependency (#899).
 *
 * A package is only worth hashing if the hash means something: the same tree packed twice
 * must produce the same bytes, so a manifest can name a sha256 and two people can compare
 * their copies. Every archive library in reach fails that quietly — it stamps the wall clock
 * into each local header, or writes entries in whatever order a map iterates. So this file
 * writes the format itself, and the four things that decide a hash are fixed here, once:
 *
 *   1. **Entry order** — sorted by UTF-8 byte order of the name. Not insertion order.
 *   2. **Modification time** — one constant for every entry (`2020-01-01 00:00`). A real mtime
 *      would make two packs of one tree differ.
 *   3. **Compression** — `node:zlib` raw deflate when it actually saves bytes, STORE when it
 *      does not. Deterministic for a given zlib, and never "always deflate": a 20-byte file is
 *      bigger deflated, and the choice is a rule rather than a coin flip.
 *   4. **No directory entries, no extra fields, no comments, no data descriptors** — the
 *      archive is files and nothing else, each with its CRC32 in the local header where a
 *      reader can check it without seeking forward.
 *
 * What it deliberately does not do: ZIP64 (> 4 GB, > 65 535 entries), encryption, symlinks,
 * and reading archives that use data descriptors. Each is refused with a message rather than
 * mis-read, because a package this repo writes never needs them and a reader that quietly
 * guesses is worse than one that says no.
 *
 * Consumed from compiled TypeScript through `scripts/zip-bridge.ts`, which resolves this
 * file's real path (the data:check harness compiles into `.datacheck/`).
 */
import { deflateRawSync, inflateRawSync } from "node:zlib";

/** Every entry carries this DOS timestamp: 2020-01-01 00:00:00, so two packs cannot differ. */
const FIXED_DOS_TIME = 0;
const FIXED_DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

/** The UTF-8 name flag. Without it a name outside ASCII is read as cp437 by most tools. */
const FLAG_UTF8 = 0x0800;

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;

const STORE = 0;
const DEFLATE = 8;

/** The CRC32 table, built once (IEEE 802.3, the polynomial zip uses). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

/** The CRC32 of a buffer, as a zip local header stores it. */
export function crc32(data) {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * The bytes of one entry and the method that stores them: deflate only when it is smaller, so
 * an already-compressed file (a PNG, a .gz) is written whole rather than inflated.
 */
function storedEntry(data) {
  if (data.length === 0) return { method: STORE, payload: data };
  const deflated = deflateRawSync(data, { level: 9 });
  return deflated.length < data.length
    ? { method: DEFLATE, payload: deflated }
    : { method: STORE, payload: data };
}

const asBuffer = (data) => (Buffer.isBuffer(data) ? data : Buffer.from(data));

/**
 * Pack `[{ name, data }]` into one zip. Names are sorted, duplicates are refused, and a name
 * that ends in `/` is refused: this writer produces files, never directory entries.
 */
export function zipEntries(entries) {
  const files = entries.map((entry) => ({ name: entry.name, data: asBuffer(entry.data) }));
  const seen = new Set();
  for (const file of files) {
    if (file.name.length === 0) throw new Error("zip: an entry needs a name");
    if (file.name.endsWith("/")) {
      throw new Error(
        `zip: "${file.name}" is a directory entry, and this writer produces files only`,
      );
    }
    if (file.name.includes("\\")) {
      throw new Error(`zip: "${file.name}" uses a backslash — zip paths are forward slashes`);
    }
    if (seen.has(file.name)) throw new Error(`zip: "${file.name}" is in the archive twice`);
    seen.add(file.name);
  }
  files.sort((left, right) =>
    Buffer.compare(Buffer.from(left.name, "utf8"), Buffer.from(right.name, "utf8")),
  );

  if (files.length > 0xffff) throw new Error("zip: more than 65 535 entries needs ZIP64");

  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const { method, payload } = storedEntry(file.data);

    if (payload.length > 0xffffffff || file.data.length > 0xffffffff) {
      throw new Error(`zip: "${file.name}" is over 4 GB, which needs ZIP64`);
    }

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4); // version needed to extract
    local.writeUInt16LE(FLAG_UTF8, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(FIXED_DOS_TIME, 10);
    local.writeUInt16LE(FIXED_DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // no extra field
    name.copy(local, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(SIG_CENTRAL, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(FLAG_UTF8, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(FIXED_DOS_TIME, 12);
    central.writeUInt16LE(FIXED_DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // a regular file, 0644
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);

    locals.push(local, payload);
    centrals.push(central);
    offset += local.length + payload.length;
  }

  const centralSize = centrals.reduce((total, buffer) => total + buffer.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(SIG_END, 0);
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with the central directory
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // no comment

  return Buffer.concat([...locals, ...centrals, end]);
}

/** The end-of-central-directory record, found from the back (a comment may follow it). */
function findEnd(buffer) {
  const earliest = Math.max(0, buffer.length - 22 - 0xffff);
  for (let at = buffer.length - 22; at >= earliest; at -= 1) {
    if (buffer.readUInt32LE(at) === SIG_END) return at;
  }
  throw new Error("zip: no end-of-central-directory record — not a zip file");
}

/**
 * Read a zip back, in central-directory order (this writer's sorted order). Every entry's
 * CRC32 is checked against its bytes, so a truncated or corrupted archive fails here rather
 * than at the far end of an install.
 */
export function unzipEntries(buffer) {
  const source = asBuffer(buffer);
  const end = findEnd(source);
  const count = source.readUInt16LE(end + 10);
  const centralSize = source.readUInt32LE(end + 12);
  const centralOffset = source.readUInt32LE(end + 16);
  if (centralOffset + centralSize > source.length) {
    throw new Error("zip: the central directory runs past the end of the file");
  }

  const entries = [];
  let at = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (source.readUInt32LE(at) !== SIG_CENTRAL) {
      throw new Error(`zip: central directory entry ${index} has a bad signature`);
    }
    const flags = source.readUInt16LE(at + 8);
    const method = source.readUInt16LE(at + 10);
    const crc = source.readUInt32LE(at + 16);
    const compressedSize = source.readUInt32LE(at + 20);
    const size = source.readUInt32LE(at + 24);
    const nameLength = source.readUInt16LE(at + 28);
    const extraLength = source.readUInt16LE(at + 30);
    const commentLength = source.readUInt16LE(at + 32);
    const localOffset = source.readUInt32LE(at + 42);
    const name = source.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    at += 46 + nameLength + extraLength + commentLength;

    if ((flags & 0x0001) !== 0) throw new Error(`zip: "${name}" is encrypted`);
    if ((flags & 0x0008) !== 0) {
      throw new Error(`zip: "${name}" uses a data descriptor, which this reader does not accept`);
    }
    if (method !== STORE && method !== DEFLATE) {
      throw new Error(
        `zip: "${name}" uses compression method ${method}, which is not store/deflate`,
      );
    }
    if (source.readUInt32LE(localOffset) !== SIG_LOCAL) {
      throw new Error(`zip: "${name}" has a bad local header signature`);
    }
    const localNameLength = source.readUInt16LE(localOffset + 26);
    const localExtraLength = source.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = source.subarray(start, start + compressedSize);
    const data = method === STORE ? Buffer.from(raw) : inflateRawSync(raw);

    if (data.length !== size) {
      throw new Error(`zip: "${name}" expected ${size} bytes and holds ${data.length}`);
    }
    if (crc32(data) !== crc) throw new Error(`zip: "${name}" fails its CRC32 check`);
    entries.push({ name, data });
  }

  return entries;
}

/** The one-line summary a CLI prints: how many entries, and the index's size in bytes. */
export function zipSummary(buffer) {
  const source = asBuffer(buffer);
  const end = findEnd(source);
  return { entries: source.readUInt16LE(end + 10), bytes: source.length };
}
