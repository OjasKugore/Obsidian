# Module 02 — HTTP Routing & REST API Contract

> Read when building the API layer of the modern replacement.

---

## Entry Point

```
index.php
  define('PATH', '');
  define('PUBLIC_PATH', __DIR__);
  require 'vendor/autoload.php';
  new PrivateBin\Controller;   ← constructor does everything
```

---

## Operations Dispatch Table

The `Request` class inspects HTTP method + GET params and sets `$_operation`:

| Operation | Trigger | Handler |
|-----------|---------|---------|
| `create` | POST/PUT/DELETE request | `Controller::_create()` |
| `read` | GET with `?{pasteid}` + JSON Accept header | `Controller::_read($id)` |
| `delete` | GET with `?pasteid=...&deletetoken=...` | `Controller::_delete($id, $token)` |
| `jsonld` | GET with `?jsonld={type}` | `Controller::_jsonld($type)` |
| `yourlsproxy` | GET with `?link=...&shortenviayourls` | `Controller::_shortenerproxy(YourlsProxy)` |
| `shlinkproxy` | GET with `?link=...&shortenviashlink` | `Controller::_shortenerproxy(ShlinkProxy)` |
| `view` (default) | All other GET requests | `Controller::_view()` — renders HTML |

---

## Response Format Detection

- **JSON API**: Detected if `HTTP_X_REQUESTED_WITH: JSONHttpRequest` OR Accept header prefers `application/json` over `text/html`
- **HTML**: Renders a PHP template via `View::draw()`

---

## JSON Response Schemas

### Success
```json
{ "status": 0, "id": "<16-hex-pasteid>", "url": "/?<pasteid>", "deletetoken": "<sha256-hmac>" }
```

### Error
```json
{ "status": 1, "message": "<translated error string>" }
```

---

## Full REST API Reference

### GET `/?{pasteid}` (HTML)
Returns the full page HTML. No authentication needed.

### GET `/?{pasteid}` (JSON — `Accept: application/json`)
Returns paste data:
```json
{
  "status": 0,
  "id": "abc123def456789a",
  "url": "/?abc123def456789a",
  "v": 2,
  "ct": "<base64 ciphertext>",
  "adata": [
    ["<base64 IV>", "<base64 salt>", 100000, 256, 128, "aes", "gcm", "zlib"],
    "plaintext",
    0,
    0
  ],
  "meta": { "time_to_live": 604800 },
  "comments": [],
  "comment_count": 0,
  "comment_offset": 0,
  "@context": "?jsonld=paste"
}
```

**Notes:**
- `meta.salt` is stripped before returning (server-side secret)
- `meta.expire_date` is converted to `meta.time_to_live` (seconds remaining)
- If `burnafterreading=1`, paste is deleted server-side before response is sent
- `comments` array contains all comments for the paste

### POST `/` — Create Paste (JSON body)
```json
{
  "v": 2,
  "ct": "<base64 ciphertext>",
  "adata": [
    ["<base64 IV>", "<base64 salt>", 100000, 256, 128, "aes", "gcm", "zlib"],
    "plaintext",
    0,
    0
  ],
  "meta": {
    "expire": "1week"
  }
}
```
**Response:**
```json
{ "status": 0, "id": "<16hexid>", "url": "/?<id>", "deletetoken": "<hmac-sha256>" }
```

### POST `/` — Create Comment (JSON body)
```json
{
  "v": 2,
  "ct": "<base64 ciphertext>",
  "adata": ["<base64 IV>", "<base64 salt>", 100000, 256, 128, "aes", "gcm", "zlib"],
  "pasteid": "<16hexid>",
  "parentid": "<16hexid>"
}
```
**Response:** `{ "status": 0, "id": "<commentid>", "url": "/?<pasteid>" }`

### GET `/?pasteid=...&deletetoken=...` — Delete Paste
Validates `hash_equals(HMAC-SHA256(pasteId, salt), deletetoken)` then deletes.
- HTML response: delete confirmation page
- JSON response: `{ "status": 0, "id": "<id>", "url": "/?<id>" }`

### GET `/?jsonld={type}` — JSON-LD Context
Types: `paste`, `pastemeta`, `comment`, `commentmeta`, `types`
Returns semantic web context for structured data consumers.

### GET `/?link=...&shortenviayourls` / `?link=...&shortenviashlink`
Server-side URL shortener proxy. Validates the link points to the same instance, then proxies to configured shortener service.

---

## Cache Headers (set on every response)
```
Cache-Control: no-store
Pragma: no-cache
Expires: Sun, 19 Nov 1978 05:00:00 UTC
Last-Modified: <now>
Vary: Accept
```

---

## Validation Flow for POST (create)

```
1. TrafficLimiter::canPass()         ← rate limit check (throws if blocked)
2. FormatV2::isValid($data)          ← paste format validation
3. strlen($data['ct']) > $sizelimit  ← size check (default 10MB)
4. $model->purge()                   ← maybe delete expired pastes (batch)
5. $paste->setData($data)            ← sanitize + validate + compute ID
6. collision check: $paste->exists() ← throw if ID already exists
7. $paste->store()                   ← persist to backend
8. return JSON {status:0, id, url, deletetoken}
```
