# Module 04 — Storage Backends

> Read when choosing or implementing the persistence layer.

---

## AbstractData Interface (`lib/Data/AbstractData.php`)

All backends implement this contract:

```php
// Paste operations
abstract create($pasteid, array &$paste): bool
abstract read($pasteid): array|false
abstract delete($pasteid): void
abstract exists($pasteid): bool

// Comment operations
abstract createComment($pasteid, $parentid, $commentid, array &$comment): bool
abstract readComments($pasteid): array
abstract existsComment($pasteid, $parentid, $commentid): bool

// KV store (namespaces: 'salt', 'traffic_limiter', 'purge_limiter')
abstract setValue($value, $namespace, $key=''): bool
abstract getValue($namespace, $key=''): string

// Purge support
abstract _getExpiredPastes($batchsize): array
abstract getAllPastes(): array

// Concrete helpers
purge($batchsize): void             // calls _getExpiredPastes + delete loop
purgeValues($namespace, $time)      // clears traffic_limiter entries older than $time
getOpenSlot(array &$comments, $created)  // handles timestamp collisions with .N suffix
sortComments(array $comments): array     // ksort SORT_NATURAL
```

---

## Backend 1: Filesystem (`lib/Data/Filesystem.php`) — Default

### Storage Layout
```
data/
  {aa}/                              <- first 2 chars of paste ID
    {bb}/                            <- chars 3-4 of paste ID
      {full16hexid}.php              <- paste JSON file
      {full16hexid}.discussion/      <- comment directory
        {pasteid}.{commentid}.{parentid}.php  <- comment file
  salt.php                           <- server salt
  traffic_limiter.php                <- IP hash -> last submission timestamp
  purge_limiter.php                  <- last purge timestamp
  .htaccess                          <- "Require all denied"
```

### File Format
Each paste/comment file starts with a PHP protection line:
```
<?php http_response_code(403); /*
{"v":2,"ct":"...","adata":[...],"meta":{...}}
```
If accessed directly via PHP, returns 403. The JSON is after the `/*`.

### Paste ID → Path Mapping
```
'e3570978f9e4aa90' → 'data/e3/57/e3570978f9e4aa90.php'
```

### Legacy Migration
`_prependRename()` migrates files without `.php` extension to the protected format.

### Purge Strategy
`_getExpiredPastes($batchsize)` — scans up to `batchsize × 10` random files via `GlobIterator`, returns expired IDs.

### Config
```ini
[model]
class = Filesystem
[model_options]
dir = PATH "data"
```

---

## Backend 2: Database (`lib/Data/Database.php`)

### Supports
- MySQL: `mysql:host=...;dbname=...;charset=UTF8`
- PostgreSQL: `pgsql:host=...;dbname=...`
- SQLite: `sqlite:/path/to/db.sq3`

### SQL Schema
```sql
-- Pastes table
CREATE TABLE {prefix}paste (
    dataid           CHAR(16)   NOT NULL,
    data             MEDIUMBLOB NOT NULL,   -- JSON encoded paste
    postdate         INT        NOT NULL,   -- UNIX timestamp
    expiredate       INT        NOT NULL,   -- 0 = never
    opendiscussion   TINYINT    NOT NULL DEFAULT 0,
    burnafterreading TINYINT    NOT NULL DEFAULT 0,
    PRIMARY KEY (dataid)
);

-- Comments table
CREATE TABLE {prefix}comment (
    dataid   CHAR(16)     NOT NULL,
    pasteid  CHAR(16)     NOT NULL,
    parentid CHAR(16)     NOT NULL,
    data     BLOB         NOT NULL,         -- JSON encoded comment
    nickname VARCHAR(255) NOT NULL DEFAULT '',
    vizhash  TEXT         NOT NULL DEFAULT '',
    postdate INT          NOT NULL,
    PRIMARY KEY (dataid),
    FOREIGN KEY (pasteid) REFERENCES {prefix}paste(dataid)
);

-- KV store (salt, traffic_limiter, purge_limiter)
CREATE TABLE {prefix}config (
    id    CHAR(16) NOT NULL,               -- hash of namespace+key
    value TEXT     NOT NULL,
    PRIMARY KEY (id)
);
```

### Config Examples

**MySQL:**
```ini
[model]
class = Database
[model_options]
dsn = "mysql:host=localhost;dbname=privatebin;charset=UTF8"
tbl = "privatebin_"
usr = "privatebin"
pwd = "password"
opt[12] = true  ; PDO::ATTR_PERSISTENT
```

**PostgreSQL:**
```ini
dsn = "pgsql:host=localhost;dbname=privatebin"
```

**SQLite:**
```ini
dsn = "sqlite:/var/lib/privatebin/db.sq3"
```

**Notes:**
- `opt[12] = true` = `PDO::ATTR_PERSISTENT = true` (connection pooling)
- Table prefix (`tbl`) is optional; defaults to empty string

---

## Backend 3: Google Cloud Storage (`lib/Data/GoogleCloudStorage.php`)

- Uses `google/cloud-storage` Composer package
- Bucket + prefix in `[model_options]`
- Supports uniform ACL (`uniformacl = true`)
- Objects: key = `{prefix}/{pasteid}`, value = JSON paste blob
- Env var alternative: `PRIVATEBIN_GCS_BUCKET`

```ini
[model]
class = GoogleCloudStorage
[model_options]
bucket = "my-bucket"
prefix = "pastes"
uniformacl = false
```

---

## Backend 4: S3 / S3-Compatible (`lib/Data/S3Storage.php`)

- Uses `aws/aws-sdk-php` Composer package
- AWS S3, Ceph/Rados, MinIO, or any S3-compatible
- `use_path_style_endpoint = true` for non-AWS endpoints

**AWS S3:**
```ini
[model]
class = S3Storage
[model_options]
region = "eu-central-1"
version = "latest"
bucket = "my-bucket"
accesskey = "AKIA..."
secretkey = "..."
```

**Ceph / MinIO / S3-compatible:**
```ini
region = "us-east-1"
version = "latest"
endpoint = "https://s3.my-ceph.invalid"
use_path_style_endpoint = true
bucket = "privatebin"
accesskey = "..."
secretkey = "..."
```

**AWS SDK credential chain (no explicit keys):**
- Omit `accesskey`/`secretkey`
- SDK reads from env vars: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
- Or from instance role/EKS IRSA

---

## Modernisation Recommendation

For the new app, replace the Filesystem backend with:

| Use Case | Recommended Backend |
|----------|-------------------|
| Hackathon / simple | PostgreSQL via Prisma (Neon serverless) |
| Edge / global | Turso (libSQL/SQLite at the edge) |
| High scale | PostgreSQL (Neon) + Redis for KV |
| Cloud-native | GCS or S3 (keep the existing backend classes) |

The KV store (traffic limiter, purge limiter, server salt) should be migrated to:
- **Redis** (Upstash) for rate limiting and ephemeral state
- **DB table** or **env var** for server salt
