# Module 05 — Configuration Reference

> Complete reference for every config key. Read when porting the config system.

---

## Config File Location

Priority order:
1. `$CONFIG_PATH` environment variable (path to directory containing `conf.php`)
2. `cfg/conf.php` (default)

Format: PHP-style INI with sections. File is PHP-protected (direct web access is blocked).

---

## `[main]` Section

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `name` | string | `PrivateBin` | Site name shown in UI and HTML title |
| `basepath` | string | `''` | Full base URL (required for OG images, URL shortener validation) |
| `discussion` | bool | `true` | Enable/disable comment system globally |
| `opendiscussion` | bool | `false` | Pre-select "open discussion" checkbox |
| `discussiondatedisplay` | bool | `true` | Show creation timestamps on comments |
| `password` | bool | `true` | Enable password field |
| `fileupload` | bool | `false` | Enable file attachment upload |
| `burnafterreadingselected` | bool | `false` | Pre-select burn-after-reading |
| `defaultformatter` | string | `plaintext` | Default formatter: `plaintext`, `syntaxhighlighting`, `markdown` |
| `syntaxhighlightingtheme` | string | `''` | CSS theme for Prettify (empty = default) |
| `sizelimit` | int | `10485760` | Max ciphertext bytes (10 MB) |
| `templateselection` | bool | `false` | Show template switcher in UI |
| `template` | string | `bootstrap5` | Default template name |
| `availabletemplates` | array | `[bootstrap5, bootstrap, ...]` | Whitelisted template names |
| `info` | string | project link HTML | Info text shown in footer (HTML allowed) |
| `notice` | string | `''` | Notice banner text (HTML allowed) |
| `languageselection` | bool | `false` | Show language selector |
| `languagedefault` | string | `''` | Force language (ISO 639-1 code, e.g. `de`) |
| `urlshortener` | string | `''` | Client-side shortener URL prefix |
| `shortenbydefault` | bool | `false` | Auto-shorten URL after paste creation |
| `qrcode` | bool | `true` | Show QR code button |
| `email` | bool | `true` | Show email share button |
| `icon` | string | `jdenticon` | Commenter avatar type: `none`, `identicon`, `jdenticon`, `vizhash` |
| `cspheader` | string | (see below) | Full Content-Security-Policy header value |
| `httpwarning` | bool | `true` | Show warning when not on HTTPS |
| `compression` | string | `zlib` | Compression mode: `zlib` or `none` |

### Default CSP Header
```
default-src 'none'; base-uri 'self'; form-action 'none'; manifest-src 'self';
connect-src * blob:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self';
font-src 'self'; frame-ancestors 'none'; frame-src blob:; img-src 'self' data: blob:;
media-src blob:; object-src blob:;
sandbox allow-same-origin allow-scripts allow-forms allow-modals allow-downloads
```

---

## `[expire]` Section

| Key | Default | Description |
|-----|---------|-------------|
| `default` | `1week` | Which expiry option is pre-selected in the UI |

---

## `[expire_options]` Section

Key-value pairs of label → seconds. The UI renders these as a dropdown.

| Key | Seconds | Human |
|-----|---------|-------|
| `5min` | 300 | 5 minutes |
| `10min` | 600 | 10 minutes |
| `1hour` | 3600 | 1 hour |
| `1day` | 86400 | 1 day |
| `1week` | 604800 | 1 week |
| `1month` | 2592000 | 1 month |
| `1year` | 31536000 | 1 year |
| `never` | 0 | Never (no expiry) |

---

## `[formatter_options]` Section

Maps formatter ID to display label. Modifying this changes what appears in the dropdown.

```ini
[formatter_options]
plaintext          = "Plain Text"
syntaxhighlighting = "Source Code"
markdown           = "Markdown"
```

---

## `[traffic]` Section

| Key | Default | Description |
|-----|---------|-------------|
| `limit` | `10` | Seconds required between posts per IP (0 = disabled) |
| `header` | `''` | HTTP header to use for client IP (e.g. `X_FORWARDED_FOR`) |
| `exempted` | `''` | Comma-separated IPs/CIDRs exempt from rate limit |
| `creators` | `''` | If non-empty: ONLY these IPs/CIDRs may create pastes |

---

## `[purge]` Section

| Key | Default | Description |
|-----|---------|-------------|
| `limit` | `300` | Minimum seconds between purge runs |
| `batchsize` | `10` | Max number of pastes deleted per purge run |

---

## `[model]` + `[model_options]` Sections

### Filesystem (default)
```ini
[model]
class = Filesystem

[model_options]
dir = PATH "data"
```

### MySQL
```ini
[model]
class = Database

[model_options]
dsn = "mysql:host=localhost;dbname=privatebin;charset=UTF8"
tbl = "privatebin_"
usr = "privatebin"
pwd = "password"
opt[12] = true   ; PDO::ATTR_PERSISTENT = true
```

### PostgreSQL
```ini
[model]
class = Database

[model_options]
dsn = "pgsql:host=localhost;dbname=privatebin;sslmode=require"
tbl = ""
usr = "privatebin"
pwd = "password"
```

### SQLite
```ini
[model]
class = Database

[model_options]
dsn = "sqlite:/var/lib/privatebin/db.sq3"
```

### Google Cloud Storage
```ini
[model]
class = GoogleCloudStorage

[model_options]
bucket     = "my-bucket-name"
prefix     = "pastes"
uniformacl = false
```

### AWS S3
```ini
[model]
class = S3Storage

[model_options]
region                  = "eu-central-1"
version                 = "latest"
bucket                  = "privatebin"
accesskey               = "AKIA..."
secretkey               = "..."
prefix                  = ""
```

### S3-Compatible (Ceph, MinIO)
```ini
[model]
class = S3Storage

[model_options]
region                  = "us-east-1"
version                 = "latest"
endpoint                = "https://s3.my-ceph.example.com"
use_path_style_endpoint = true
bucket                  = "privatebin"
accesskey               = "..."
secretkey               = "..."
```

---

## `[shlink]` Section

```ini
[shlink]
apiurl = "https://shlink.example.com/rest/v3/short-urls"
apikey = "your_api_key"
```
Then set `urlshortener = "${basepath}?shortenviashlink&link="` in `[main]`.

---

## `[yourls]` Section

```ini
[yourls]
signature = "your_signature_token"
apiurl    = "https://yourls.example.com/yourls-api.php"
```
Then set `urlshortener = "${basepath}?shortenviayourls&link="` in `[main]`.

---

## `[sri]` Section

SHA-512 SRI hashes for each bundled JS file. Auto-populated at build time. Override only if you replace bundled files.

```ini
[sri]
js/privatebin.js     = "sha512-..."
js/purify-3.4.12.js  = "sha512-..."
; ... one entry per bundled JS file
```

---

## Environment Variables

| Variable | Usage |
|----------|-------|
| `CONFIG_PATH` | Override path to `conf.php` directory (Docker-friendly) |
| `PRIVATEBIN_GCS_BUCKET` | GCS bucket name (alternative to config file) |
| `AWS_ACCESS_KEY_ID` | AWS S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 credentials |
| `AWS_SESSION_TOKEN` | AWS temporary credentials |
