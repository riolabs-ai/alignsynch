/**
 * The bridge to `scripts/zip.mjs` (#899).
 *
 * The zip writer is a `.mjs` module on purpose — it is plain node, it has no types to earn,
 * and a reader can open it and see the format. The data:check harness compiles TypeScript into
 * `.datacheck/`, so a relative `import "../zip.mjs"` would look for the module beside the
 * *compiled* file and not find it. This bridge resolves the real path from `__dirname` and
 * re-exports a typed surface, so a test exercises the shipped module rather than a copy.
 */
import { join } from "node:path";

export interface ZipEntry {
  readonly name: string;
  readonly data: Buffer;
}

export interface ZipModule {
  readonly crc32: (data: Buffer | Uint8Array) => number;
  readonly zipEntries: (
    entries: readonly { readonly name: string; readonly data: Buffer | Uint8Array }[],
  ) => Buffer;
  readonly unzipEntries: (buffer: Buffer | Uint8Array) => ZipEntry[];
  readonly zipSummary: (buffer: Buffer | Uint8Array) => {
    readonly entries: number;
    readonly bytes: number;
  };
}

const zip: ZipModule = require(join(__dirname, "..", "..", "scripts", "zip.mjs")) as ZipModule;

export const { crc32, zipEntries, unzipEntries, zipSummary } = zip;
