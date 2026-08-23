# Module 03 — PHP Backend Classes

> Covers every PHP class with method-level detail. Read when porting or understanding the backend.

---

## Class Map

```
lib/
  Controller.php         Main controller — entry point, routing, response
  Request.php            HTTP input parser
  Configuration.php      INI config reader + defaults
  Model.php              Factory: creates Paste + manages purge
  Model/
    AbstractModel.php    Base class for Paste + Comment
    Paste.php            Paste CRUD, expiry, delete token
    Comment.php          Comment storage + icon generation
  Data/                  → see Module 04 (Storage Backends)
  Persistence/
    ServerSalt.php       Per-installation HMAC salt
    TrafficLimiter.php   Per-IP rate limiting
    PurgeLimiter.php     Rate-limits the purge operation
  Proxy/
    AbstractProxy.php    URL shortener proxy base
    YourlsProxy.php      YOURLS integration
    ShlinkProxy.php      Shlink integration
  FormatV2.php           Paste payload validator
  I18n.php               Server-side translations
  View.php               PHP template renderer
  Json.php               JSON encode/decode wrapper
  Vizhash16x16.php       Procedural 16x16 PNG icon generator
```

---

## `lib/Controller.php`

**Constants:**
- `VERSION = '2.0.5'`
- `MIN_PHP_VERSION = '7.4.0'`
- `GENERIC_ERROR = 'Document does not exist, has expired or has been deleted.'`

**Private properties:**
- `$_conf` — `Configuration` instance
- `$_error` — error string for view rendering
- `$_status` — status string for view rendering
- `$_is_deleted` — bool flag for delete confirmation view
- `$_json` — JSON string to echo for API responses
- `$_model` — `Model` factory instance
- `$_request` — `Request` instance
- `$_urlBase` — parsed base URL path

**Key methods:**
- `__construct(?Configuration $config)` — validates PHP version, loads config, calls `_init()`, dispatches operation, sets cache headers, outputs JSON or HTML
- `_init()` — creates `Model`, `Request`, sets language and template defaults
- `_setDefaultLanguage()` — sets `$_COOKIE['lang']` and sends `lang` cookie
- `_setDefaultTemplate()` — manages template cookie
- `_setCacheHeaders()` — `Cache-Control: no-store`, `Pragma: no-cache`, `Expires`, `Last-Modified`, `Vary: Accept`
- `_create()` — validates rate limit → validates format → checks size → stores paste or comment → returns JSON result
- `_delete($dataid, $deletetoken)` — validates paste existence → `hash_equals()` token check → deletes
- `_read($dataid)` — JSON API only; returns paste data minus the `salt` field
- `_view()` — sets 7 security headers, builds template variables, calls `View::draw()`
- `_jsonld($type)` — serves one of 5 JSON-LD context files
- `_json_error($error)` — builds `{"status":1,...}`
- `_json_result($dataid, $other)` — builds `{"status":0,"id":...,"url":...}`
- `_shortenerproxy(AbstractProxy)` — delegates to proxy, sets `$_error` or `$_status`

---

## `lib/Request.php`

**Constants:** `MIME_JSON`, `MIME_HTML`, `MIME_XHTML`

**Private state:**
- `$_inputStream` (static) — defaults to `php://input`; overridable for tests
- `$_operation` — one of `view|create|read|delete|jsonld|yourlsproxy|shlinkproxy`
- `$_params` — sanitized GET/POST params
- `$_isJsonApi` — bool

**Constructor logic:**
1. Calls `_detectJsonRequest()` — parses `HTTP_ACCEPT` header with RFC-compliant quality negotiation
2. For POST/PUT/DELETE: reads `php://input`, JSON-decodes it into `$_params`
3. For GET: runs `filter_var_array($_GET, [...])` with per-key FILTER constants
4. Determines operation from param combinations

**`getPasteId()`** — scans `$_GET` for a key matching `/^[a-f0-9]{16}$/` with empty value

**`getData()`** — returns: `{adata, v, ct, meta}` for pastes; `{adata, v, ct, pasteid, parentid}` for comments

**`_detectJsonRequest()`** — checks `X-Requested-With` header first, then parses `q=` quality values from Accept header

---

## `lib/Configuration.php`

**Reads config from:** `CONFIG_PATH` env var → `cfg/conf.php` (INI format)
**Required sections:** `[main]`, `[model]`, `[model_options]`

**Key methods:**
- `getKey($key, $section='main')` — throws if key missing
- `getSection($section)` — throws if section missing
- `getDefaults()` (static) — returns the full defaults array

> See **Module 05** for the complete configuration key reference.

---

## `lib/Model.php` — Factory

- Creates the storage backend lazily: `new PrivateBin\Data\{class}($model_options)`
- `getPaste($pasteId=null)` — returns `new Paste($conf, $store)` optionally with ID set
- `purge()` — checks `PurgeLimiter::canPurge()`, then calls `$store->purge($batchsize)`
- `getStore()` — lazy-initializes backend from `model.class` config key

---

## `lib/Model/AbstractModel.php`

**Constants:**
- `INVALID_DATA_ERROR = 'Invalid data.'`
- `COLLISION_ERROR = 'You are unlucky. Try again.'`

**State:** `$_id`, `$_data = ['meta'=>[]]`, `$_conf`, `$_store`

**ID format:** 16 hex chars, validated by `/\A[a-f0-9]{16}\z/`
**ID generation:** `hash('fnv1a64', $data['ct'])` — 64-bit FNV-1a hash of ciphertext

**Key methods:**
- `setData(array &$data)` — calls `_sanitize()`, `_validate()`, sets `$_data`, computes ID
- `isValidId($id)` (static) — regex check
- `_sanitize()` (abstract) — transform incoming data
- `_validate()` (hook, default no-op) — throw on invalid data

---

## `lib/Model/Paste.php`

**adata array indices:**
```
adata[0] = cipher params [iv, salt, iterations, keysize, tagsize, algo, mode, compression]
adata[1] = formatter (plaintext|syntaxhighlighting|markdown)
adata[2] = open_discussion (0|1)
adata[3] = burn_after_reading (0|1)
```

**Methods:**
- `get()` — reads from store; checks expiry; deletes if burn-after-reading; appends comments + `@context`; strips `expire_date` and `created` from returned meta
- `store()` — collision check; generates `meta.salt = ServerSalt::generate()` (512 hex chars); calls `$store->create()`
- `delete()` — calls `$store->delete(id)`
- `exists()` — delegates to store
- `getComment($parentId, $commentId='')` — creates `Comment` linked to this paste
- `getComments()` — reads all comments; optionally strips `created` timestamps
- `getDeleteToken()` — `hash_hmac('sha256', $pasteid, $meta['salt'])`
- `isOpendiscussion()` — reads `adata[2]`
- `_sanitize()` — converts `meta.expire` string key → `meta.expire_date` UNIX timestamp
- `_validate()` — rejects invalid formatters; rejects discussion+burn-after-reading combo

---

## `lib/Model/Comment.php`

**`store()` steps:**
1. Validates paste exists
2. Validates `isOpendiscussion()` and `discussion` config key
3. Collision check (`exists()`)
4. Sets `meta.created = time()`
5. Generates icon (PNG data URI stored in `meta.icon`)
6. Calls `$store->createComment(pasteid, parentid, commentid, data)`

**Icon generation (in `_sanitize()`):**
- IP hash: `hash_hmac('sha512', $IP, $serverSalt)` via `TrafficLimiter::getHash()`
- `identicon` → `yzalis/identicon` → 16px PNG data URI
- `jdenticon` → `jdenticon/jdenticon` → 16px PNG, transparent background
- `vizhash` → `Vizhash16x16` → custom 16x16 procedural PNG

---

## `lib/Persistence/ServerSalt.php`

- Stored in backend's `salt` namespace
- Generated once: `bin2hex(random_bytes(256))` → 512 hex chars
- Used as HMAC key for: delete tokens, IP icons, traffic limiter hashes
- Static `$_salt` property cached; reset on `setStore()` call

---

## `lib/Persistence/TrafficLimiter.php`

**Logic:**
1. If `creators` list set: only those IPs may create
2. If `limit < 1`: disabled
3. If IP matches `exempted` CIDR: passes
4. Else: check last submission timestamp for IP hash; throw if within `limit` seconds

**IP detection:** default `REMOTE_ADDR`; configurable header (e.g. `HTTP_X_FORWARDED_FOR`)
**Hash stored:** `hash_hmac('sha256', $ip, $serverSalt)` — no raw IPs
**Purge:** old entries purged on each passing request

---

## `lib/Persistence/PurgeLimiter.php`

- Min interval between purges: `limit` seconds (default 300)
- `canPurge()`: reads `purge_limiter` value; if elapsed > limit → updates + returns true
- Prevents expensive batch deletes on every request

---

## `lib/FormatV2.php` — Paste Validator

**Required keys for paste:** `adata`, `v`, `ct`, `meta` (exact count enforced)
**Required keys for comment:** `adata`, `v`, `ct`, `pasteid`, `parentid`

**adata structure for paste:**
```
adata[0] = cipher params array (min 8 elements):
  [0] IV        (base64, max 24 chars)
  [1] salt      (base64, max 14 chars)
  [2] iterations (int, > 10000)
  [3] key size  (128|192|256)
  [4] tag size  (64|96|128)
  [5] algorithm ('aes')
  [6] mode      ('ctr'|'cbc'|'gcm')
  [7] compression ('zlib'|'none')
adata[1] = formatter string
adata[2] = open_discussion (0|1)
adata[3] = burn_after_reading (0|1)
```

**For comments:** `adata` IS the flat cipher params array (no nesting)

**Additional validation:**
- `ct` must be valid base64
- `v >= 2` (numeric)
- `iterations > 10000` (NIST minimum)
- Entropy check: `strlen($ct) > strlen(gzdeflate($ct))` — rejects non-ciphertext
- `meta` must contain exactly one key: `expire`

---

## `lib/Proxy/AbstractProxy.php`

- Validates URL points to same instance (uses `basepath` config)
- Uses `file_get_contents` + stream context to call shortener API
- Subclasses implement: `_getProxyUrl()`, `_getProxyPayload()`, `_extractShortUrl()`

**YOURLS:** POST `{signature, action:'shorturl', url, format:'json'}` → extracts `$data['shorturl']`
**Shlink:** POST `{longUrl}` + `X-Api-Key` header → extracts `$data['shortUrl']`

---

## `lib/I18n.php`

- 39 language files in `i18n/{lang}.json`
- Browser language detection via `Accept-Language` header
- Cookie override: `lang` (SameSite=Lax; Secure)
- `I18n::_($msg, ...$args)` — printf-style, plural-aware translation
- `I18n::encode($str)` — HTML entity encoding for template output
- `I18n::isRtl()` — true for Arabic, Hebrew, Farsi
- `I18n::getLanguage()` — cookie → languagedefault config → Accept-Language

---

## `lib/View.php` — Template Engine

- `assign($name, $value)` — stores template variable
- `draw($template)` — validates path in `tpl/`, calls `extract($variables)` + `include $path`
- `_linkTag($file)` — emits `<link rel="modulepreload">` with SRI hash
- `_scriptTag($file, $attrs)` — emits `<script defer crossorigin="anonymous">` with SRI + cache buster

**Template variables available in `tpl/*.php`:**
```
CSPHEADER, ERROR, NAME, BASEPATH, STATUS, ISDELETED, VERSION,
DISCUSSION, OPENDISCUSSION, MARKDOWN, SYNTAXHIGHLIGHTING, SYNTAXHIGHLIGHTINGTHEME,
FORMATTER, FORMATTERDEFAULT, INFO, NOTICE, BURNAFTERREADINGSELECTED,
PASSWORD, FILEUPLOAD, LANGUAGESELECTION, LANGUAGES, TEMPLATESELECTION, TEMPLATES,
EXPIRE, EXPIREDEFAULT, URLSHORTENER, SHORTENBYDEFAULT, QRCODE, EMAIL,
HTTPWARNING, HTTPSLINK, COMPRESSION, SRI
```
