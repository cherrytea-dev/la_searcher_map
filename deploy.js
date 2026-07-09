#!/usr/bin/env node
/**
 * deploy.js — Deploy LizaAlert Searcher Map to Yandex Cloud Object Storage
 *
 * Uses AWS SDK v3 (@aws-sdk/client-s3) which fully supports
 * S3-compatible storage like Yandex Object Storage.
 *
 * Usage:
 *   node deploy.js              # Deploy using .env file
 *   node deploy.js --dry-run    # Preview what will be uploaded
 *   node deploy.js --help       # Show help
 *
 * Environment variables (from .env):
 *   AWS_ACCESS_KEY_ID         Service account static access key
 *   AWS_SECRET_ACCESS_KEY     Service account static secret key
 *   YC_STORAGE_BUCKET         Object Storage bucket name
 *   YC_STORAGE_ENDPOINT       S3 endpoint (default: https://storage.yandexcloud.net)
 *   YC_STORAGE_REGION         Region (default: us-east-1)
 *   YC_STORAGE_PREFIX         Subfolder in the bucket (optional, e.g. "v2" or "staging")
 *                             If empty or not set, files go to bucket root.
 */

const path = require('path');
const fs = require('fs');

// ─── Help ──────────────────────────────────────────────────────────────────
if (process.argv.includes('--help')) {
  console.log(`
Usage: node deploy.js [OPTIONS]

Deploy the LizaAlert Searcher Map to Yandex Cloud Object Storage.

Options:
  --dry-run    List files that would be uploaded without actually uploading
  --help       Show this help message

Environment variables (can be set in .env file):
  AWS_ACCESS_KEY_ID         Service account static access key
  AWS_SECRET_ACCESS_KEY     Service account static secret key
  YC_STORAGE_BUCKET         Object Storage bucket name
  YC_STORAGE_ENDPOINT       S3 endpoint (default: https://storage.yandexcloud.net)
  YC_STORAGE_REGION         Region (default: us-east-1)
  YC_STORAGE_PREFIX         Subfolder in the bucket (optional, e.g. "v2" or "staging")
                            If empty or not set, files go to bucket root.

Example:
  cp .env.example .env
  # fill in credentials
  node deploy.js --dry-run
  node deploy.js
`);
  process.exit(0);
}

// ─── Load .env ─────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    // Only set if not already in environment (env vars take precedence)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// ─── Validate ──────────────────────────────────────────────────────────────
const BUCKET = process.env.YC_STORAGE_BUCKET;
const ENDPOINT = process.env.YC_STORAGE_ENDPOINT || 'https://storage.yandexcloud.net';
const REGION = process.env.YC_STORAGE_REGION || 'us-east-1';
const SOURCE_DIR = path.resolve(__dirname, 'src');
const DRY_RUN = process.argv.includes('--dry-run');

// Normalize prefix: strip leading/trailing slashes, default to empty string
const PREFIX = (process.env.YC_STORAGE_PREFIX || '').replace(/^\/+|\/+$/g, '');

if (!BUCKET) {
  console.error('Error: YC_STORAGE_BUCKET is not set in .env');
  process.exit(1);
}
if (!process.env.AWS_ACCESS_KEY_ID) {
  console.error('Error: AWS_ACCESS_KEY_ID is not set in .env');
  process.exit(1);
}
if (!process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('Error: AWS_SECRET_ACCESS_KEY is not set in .env');
  process.exit(1);
}

// ─── Collect files ─────────────────────────────────────────────────────────
const { globSync } = require('glob');
const files = globSync('**/*', { cwd: SOURCE_DIR, nodir: true, dot: true });

console.log('');
console.log('══════════════════════════════════════════════════════════════');
console.log('  Deploying to Yandex Cloud Object Storage');
console.log(`  Bucket:   ${BUCKET}`);
console.log(`  Prefix:   ${PREFIX || '(root)'}`);
console.log(`  Source:   ${SOURCE_DIR}`);
console.log(`  Endpoint: ${ENDPOINT}`);
console.log(`  Region:   ${REGION}`);
console.log(`  Files:    ${files.length}`);
console.log('══════════════════════════════════════════════════════════════');
console.log('');

if (DRY_RUN) {
  console.log('── Dry run — files that would be uploaded ──');
  for (const file of files) {
    const key = PREFIX ? `${PREFIX}/${file}` : file;
    console.log(`  ${key}`);
  }
  console.log('');
  console.log('Dry run complete. Run without --dry-run to deploy.');
  process.exit(0);
}

// ─── Deploy using AWS SDK v3 ──────────────────────────────────────────────
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { lookup } = require('mime-types');
const crypto = require('crypto');

const s3Client = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false, // Yandex Object Storage uses virtual-hosted style
});

/**
 * Build the full S3 object key from a relative file path.
 * If PREFIX is set, prepend it (e.g. "v2/index.html").
 * Always use forward slashes.
 */
function buildKey(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  return PREFIX ? `${PREFIX}/${normalized}` : normalized;
}

/**
 * Compute MD5 hash of a file for ETag comparison.
 */
function computeMD5(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Get Content-Type based on file extension.
 */
function getContentType(filePath) {
  const mime = lookup(filePath);
  return mime || 'application/octet-stream';
}

/**
 * Determine if a file should be gzipped based on its extension.
 */
function shouldGzip(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.html', '.css', '.js', '.json', '.svg', '.txt', '.csv', '.xml'].includes(ext);
}

async function deploy() {
  // Step 1: List existing objects with their ETags for content comparison
  let existingKeys = new Set();
  let remoteMetadata = new Map(); // key → { etag }
  let isTruncated = true;
  let continuationToken;

  const listParams = {
    Bucket: BUCKET,
  };
  if (PREFIX) {
    listParams.Prefix = PREFIX + '/';
  }

  while (isTruncated) {
    const listCommand = new ListObjectsV2Command({
      ...listParams,
      ContinuationToken: continuationToken,
    });
    const listResponse = await s3Client.send(listCommand);
    if (listResponse.Contents) {
      for (const obj of listResponse.Contents) {
        existingKeys.add(obj.Key);
        // Strip surrounding quotes from ETag if present
        const etag = obj.ETag ? obj.ETag.replace(/^"/, '').replace(/"$/, '') : null;
        remoteMetadata.set(obj.Key, { etag });
      }
    }
    isTruncated = listResponse.IsTruncated;
    continuationToken = listResponse.NextContinuationToken;
  }

  console.log(`  Existing objects in bucket: ${existingKeys.size}`);

  // Step 2: Upload files (only new or content-changed ones)
  let uploaded = 0;
  let skipped = 0;
  const uploadedKeys = new Set();

  for (const relativePath of files) {
    const localPath = path.join(SOURCE_DIR, relativePath);
    const contentType = getContentType(relativePath);
    const doGzip = shouldGzip(relativePath);
    const key = buildKey(relativePath);

    uploadedKeys.add(key);

    // Compute local MD5 for content comparison
    const localMD5 = await computeMD5(localPath);

    const remote = remoteMetadata.get(key);
    if (remote) {
      // File exists remotely — compare MD5 with ETag
      if (remote.etag === localMD5) {
        skipped++;
        continue;
      }
      // Content differs — will re-upload below
    }

    // Read and optionally gzip file content
    let fileContent = fs.readFileSync(localPath);
    const params = {
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
    };

    if (doGzip) {
      const zlib = require('zlib');
      params.Body = zlib.gzipSync(fileContent);
      params.ContentEncoding = 'gzip';
    } else {
      params.Body = fileContent;
    }

    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    uploaded++;
    console.log(`  ↑ ${key}`);
  }

  // Step 3: Delete files that no longer exist locally (only under our prefix)
  let deleted = 0;
  for (const key of existingKeys) {
    if (!uploadedKeys.has(key)) {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      });
      await s3Client.send(command);
      deleted++;
      console.log(`  ✗ ${key} (removed)`);
    }
  }

  // Summary
  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Summary:');
  console.log(`  Uploaded:              ${uploaded}`);
  console.log(`  Skipped (unchanged):   ${skipped}`);
  console.log(`  Deleted (stale):       ${deleted}`);
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`✅ Deployment complete!`);
  console.log('');
  const baseUrl = `https://${BUCKET}.storage.yandexcloud.net`;
  const fullUrl = PREFIX ? `${baseUrl}/${PREFIX}/` : `${baseUrl}/`;
  console.log(`  Your site should be available at:`);
  console.log(`  ${fullUrl}`);
  console.log('');
}

deploy().catch((err) => {
  console.error('Deployment failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
