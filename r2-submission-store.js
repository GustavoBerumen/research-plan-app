'use strict';

// Private S3 API only. Neither bucket names nor credentials go to the browser.
const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const isMissing = e => e?.$metadata?.httpStatusCode === 404 || e?.name === 'NoSuchKey';
const isConditional = e => [409, 412].includes(e?.$metadata?.httpStatusCode);

function createR2Store(env, client, { timeoutMs = 8000 } = {}) {
  const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const account = env.RPA_R2_ACCOUNT_ID;
  const bucket = env.RPA_R2_BUCKET;
  if (!/^[a-f0-9]{32}$/.test(account || '') || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket || '') ||
      !env.RPA_R2_ACCESS_KEY_ID || !env.RPA_R2_SECRET_ACCESS_KEY) throw new Error('Private R2 storage configuration is incomplete.');
  client ||= new S3Client({
    region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.RPA_R2_ACCESS_KEY_ID, secretAccessKey: env.RPA_R2_SECRET_ACCESS_KEY },
    maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
  });
  async function send(Command, input) {
    return client.send(new Command({ Bucket: bucket, ...input }), { abortSignal: AbortSignal.timeout(timeoutMs) });
  }
  return {
    async get(key) {
      const started = Date.now();
      let result;
      try { result = await send(GetObjectCommand, { Key: key }); }
      catch (e) { if (isMissing(e)) return null; throw e; }
      let timer;
      const consume = async () => {
        const chunks = []; let size = 0;
        for await (const chunk of result.Body) {
          size += chunk.length;
          if (size > MAX_RECORD_BYTES) { result.Body.destroy?.(); throw new Error('Stored record is too large.'); }
          chunks.push(Buffer.from(chunk));
        }
        return { value: JSON.parse(Buffer.concat(chunks).toString('utf8')), etag: result.ETag };
      };
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => {
        const error = new Error('Private storage read timed out.'); result.Body.destroy?.(error); reject(error);
      }, Math.max(1, timeoutMs - (Date.now() - started))); });
      try { return await Promise.race([consume(), deadline]); } finally { clearTimeout(timer); }
    },
    async put(key, value, { absent = false, etag } = {}) {
      if (!absent && !etag) throw new Error('A conditional write is required.');
      const body = JSON.stringify(value);
      if (Buffer.byteLength(body) > MAX_RECORD_BYTES) throw new Error('Stored record is too large.');
      try {
        await send(PutObjectCommand, { Key: key, Body: body, ContentType: 'application/json', CacheControl: 'no-store',
          ...(absent ? { IfNoneMatch: '*' } : { IfMatch: etag }) });
        return true;
      } catch (e) { if (isConditional(e)) return false; throw e; }
    },
    async *keys(prefix) {
      let token;
      do {
        const page = await send(ListObjectsV2Command, { Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 });
        for (const item of page.Contents || []) yield item.Key;
        if (page.IsTruncated && !page.NextContinuationToken) throw new Error('Incomplete storage listing.');
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
    },
  };
}
module.exports = { createR2Store, MAX_RECORD_BYTES };
