/**
 * Neon object storage — an S3-compatible PUT/GET client with no SDK (#145).
 *
 * The point of the decision recorded on the issue is that object storage lives in the **same
 * Neon project** as the database, so a preview branch carries rows, files and users together.
 * This module is the app's half of that: a signed request, built with `node:crypto`, against
 * the branch's endpoint.
 *
 * It is written by hand because the scope of this issue allows exactly one new runtime
 * dependency (`pg`): an AWS SDK for a put-and-get would be a much larger tree for four
 * headers and an HMAC chain. What it implements is AWS Signature Version 4 for the `s3`
 * service, path-style addressing — the subset Neon's endpoint documents.
 *
 * Configuration is the four names the issue standardises, with the names `neon env pull`
 * writes as a fallback, so a pulled `.env.local` works without renaming anything:
 *
 *   NEON_OBJSTORE_ENDPOINT  ← AWS_ENDPOINT_URL_S3
 *   NEON_OBJSTORE_ACCESS_KEY ← AWS_ACCESS_KEY_ID
 *   NEON_OBJSTORE_SECRET_KEY ← AWS_SECRET_ACCESS_KEY
 *   NEON_OBJSTORE_BUCKET    (no equivalent — the bucket is ours to name)
 *   NEON_OBJSTORE_REGION    ← AWS_REGION (default us-east-2)
 *
 * Nothing here is imported by a page: no media moves in this release, and `public/media`
 * stays the registry (`data/media.ts`). The client exists so v1.2 uploads through it, and so
 * `pnpm objstore:smoke` can prove the branch's bucket round-trips today.
 */
import { createHash, createHmac } from "node:crypto";

export interface ObjectStoreConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKey: string;
  readonly secretKey: string;
}

const ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "s3";
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function firstSet(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

/** The four credentials, or an error that names which one is missing. */
export function objectStoreConfig(): ObjectStoreConfig {
  const missing: string[] = [];
  const endpoint = firstSet(["NEON_OBJSTORE_ENDPOINT", "AWS_ENDPOINT_URL_S3"]);
  const accessKey = firstSet(["NEON_OBJSTORE_ACCESS_KEY", "AWS_ACCESS_KEY_ID"]);
  const secretKey = firstSet(["NEON_OBJSTORE_SECRET_KEY", "AWS_SECRET_ACCESS_KEY"]);
  const bucket = firstSet(["NEON_OBJSTORE_BUCKET"]);
  if (endpoint === undefined) missing.push("NEON_OBJSTORE_ENDPOINT (or AWS_ENDPOINT_URL_S3)");
  if (accessKey === undefined) missing.push("NEON_OBJSTORE_ACCESS_KEY (or AWS_ACCESS_KEY_ID)");
  if (secretKey === undefined) missing.push("NEON_OBJSTORE_SECRET_KEY (or AWS_SECRET_ACCESS_KEY)");
  if (bucket === undefined) missing.push("NEON_OBJSTORE_BUCKET");
  if (missing.length > 0) {
    throw new Error(`object storage is not configured — missing ${missing.join(", ")}`);
  }
  return {
    endpoint: endpoint as string,
    region: firstSet(["NEON_OBJSTORE_REGION", "AWS_REGION"]) ?? "us-east-2",
    bucket: bucket as string,
    accessKey: accessKey as string,
    secretKey: secretKey as string,
  };
}

const sha256 = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");

const hmac = (key: string | Buffer, data: string): Buffer =>
  createHmac("sha256", key).update(data, "utf8").digest();

/** RFC 3986, which is what SigV4 signs — `encodeURIComponent` leaves `!'()*` alone. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** `/bucket/some/key` with every segment encoded, `/` between them kept. */
function pathFor(bucket: string, key: string): string {
  return `/${[bucket, ...key.split("/")].map(encodeRfc3986).join("/")}`;
}

export interface SignedRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
}

/**
 * A signed request for one object key.
 *
 * `amzDate` and the credential scope's short date come from `when`, which is injectable so a
 * test can sign a fixed instant; the smoke script uses the clock.
 */
export function signRequest(
  config: ObjectStoreConfig,
  method: "GET" | "PUT" | "DELETE",
  key: string,
  body: Uint8Array = new Uint8Array(),
  when: Date = new Date(),
): SignedRequest {
  const url = new URL(config.endpoint);
  const canonicalUri = pathFor(config.bucket, key);
  const amzDate = when
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const shortDate = amzDate.slice(0, 8);
  const payloadHash = body.length === 0 ? EMPTY_SHA256 : sha256(body);

  const canonicalHeaders =
    `host:${url.host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${shortDate}/${config.region}/${SERVICE}/aws4_request`;
  const stringToSign = [ALGORITHM, amzDate, scope, sha256(canonicalRequest)].join("\n");

  const dateKey = hmac(`AWS4${config.secretKey}`, shortDate);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, SERVICE);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  return {
    url: `${url.origin}${canonicalUri}`,
    headers: {
      authorization: `${ALGORITHM} Credential=${config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  };
}

async function expectOk(response: Response, operation: string, key: string): Promise<void> {
  if (response.ok) return;
  const detail = (await response.text()).slice(0, 500);
  throw new Error(
    `${operation} "${key}" failed: ${response.status} ${response.statusText} — ${detail}`,
  );
}

/** Writes one object. `contentType` is metadata, not part of the signature. */
export async function putObject(
  key: string,
  body: Uint8Array,
  contentType = "application/octet-stream",
): Promise<void> {
  const config = objectStoreConfig();
  const request = signRequest(config, "PUT", key, body);
  const response = await fetch(request.url, {
    method: "PUT",
    headers: { ...request.headers, "content-type": contentType },
    body,
  });
  await expectOk(response, "PUT", key);
}

/** Reads one object back, byte for byte. */
export async function getObject(key: string): Promise<Uint8Array> {
  const config = objectStoreConfig();
  const request = signRequest(config, "GET", key);
  const response = await fetch(request.url, { method: "GET", headers: request.headers });
  await expectOk(response, "GET", key);
  return new Uint8Array(await response.arrayBuffer());
}

/** Removes one object — used by the smoke script so a repeated run leaves nothing behind. */
export async function deleteObject(key: string): Promise<void> {
  const config = objectStoreConfig();
  const request = signRequest(config, "DELETE", key);
  const response = await fetch(request.url, { method: "DELETE", headers: request.headers });
  await expectOk(response, "DELETE", key);
}

/** The bucket the client talks to, for a report line that names what it proved. */
export function bucketName(): string {
  return objectStoreConfig().bucket;
}
