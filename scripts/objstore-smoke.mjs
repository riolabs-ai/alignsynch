#!/usr/bin/env node
/**
 * `pnpm objstore:smoke` — put an object, get it back, compare the bytes (#145).
 *
 * The claim this proves is the branch-level one: the object storage in the Neon project the
 * database lives in accepts a signed `PUT` and serves the same bytes back on `GET`. It is not
 * a media pipeline and it uploads nothing from `public/`.
 *
 * The object is removed again at the end, so running it twice leaves the bucket as it found it
 * — except for the smoke key itself, which exists for the length of one run.
 */
import { randomUUID } from "node:crypto";
import { bucketName, deleteObject, getObject, putObject } from "../lib/objstore.ts";
import { loadEnv } from "./load-env.mjs";

/** 26 bytes, not all zeroes: a truncated or coerced body would compare unequal. */
function payload() {
  return new TextEncoder().encode(`alignsynch-objstore-${randomUUID().slice(0, 8)}`);
}

function main() {
  loadEnv();
  return (async () => {
    const key = `smoke/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.bin`;
    const body = payload();
    const bucket = bucketName();

    const started = Date.now();
    await putObject(key, body, "application/octet-stream");
    const readBack = await getObject(key);

    if (readBack.length !== body.length || !readBack.every((byte, index) => byte === body[index])) {
      throw new Error(
        `round trip differs: wrote ${body.length} byte(s), read ${readBack.length} byte(s)`,
      );
    }

    await deleteObject(key);

    console.log(`✓ objstore:smoke — bucket "${bucket}", key ${key}`);
    console.log(
      `  put ${body.length} byte(s), got ${readBack.length} back, bytes identical, object removed`,
    );
    console.log(`  ${Date.now() - started} ms`);
  })();
}

main().catch((error) => {
  console.error(`\n✗ objstore:smoke failed: ${error.message}`);
  process.exitCode = 1;
});
