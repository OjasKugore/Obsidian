# Module 07 — JavaScript Frontend Architecture

> Read when building the frontend. Covers all internal JS classes, bundled libs, template system, and i18n.

---

## Overview

`js/privatebin.js` — 6163 lines, single IIFE module:
```javascript
window.PrivateBin = (function () {
  // all classes defined here as revealing modules
  return { UiManager };
})();
```

No build step, no bundler, no ES modules — served directly from the web root.

---

## All Internal Classes

| Class | Role |
|-------|------|
| `CryptoData` | Base class for Paste/Comment; holds `ct` + `adata`; provides `getCipherData()` |
| `Paste` | Extends CryptoData; adds `getFormat()`, `getTimeToLive()`, `isBurnAfterReadingEnabled()`, `isDiscussionEnabled()` |
| `Comment` | Extends CryptoData; adds `getCreated()`, `getIcon()` |
| `Helper` | Static utilities (see below) |
| `I18n` | Client-side translation (see below) |
| `Alert` | UI feedback: `showError()`, `showStatus()`, `hideLoading()`, `showLoading()` |
| `Model` | Client-side data model: `getPasteId()`, `getPasteKey()`, `getPasteData()`, `getExpirationDefault()`, `getFormatDefault()`, `getTemplate()` |
| `ServerInteraction` | XHR wrapper: `prepare()`, `setUrl()`, `setData()`, `setSuccess()`, `setFailure()`, `run()`, `parseUploadError()` |
| `CryptTool` | Crypto: `cipher()`, `decipher()`, `getSymmetricKey()`, `base58encode()`, `base58decode()` |
| `UiHelper` | DOM utilities, event delegation helpers |
| `TopNav` | Navbar button visibility: `showViewButtons()`, `showEditorButtons()`, `hideAllButtons()` |
| `Editor` | Paste editor: text area, attachment upload, drag-drop, format switching |
| `PasteViewer` | Decrypts and renders paste content (plaintext, syntax, markdown, attachments) |
| `DiscussionViewer` | Renders comment threads; handles new comment submission |
| `PasteEncryptor` | Orchestrates create flow: reads editor → calls CryptTool → calls ServerInteraction |
| `PasteDecryptor` | Orchestrates read flow: fetches paste → calls CryptTool → calls PasteViewer |
| `AttachmentViewer` | Previews encrypted attachments: image, video, audio, PDF, generic download |
| `QrCreator` | Generates QR code via `kjua` library |
| `UiManager` | Page init, mode detection (create vs view), bootstraps all other modules |

---

## `Helper` Module — Key Methods

```javascript
Helper.secondsToHuman(seconds)        // → [value, unit]  e.g. [7, 'day']
Helper.durationToSeconds(str)         // '1week' → 604800
Helper.selectText(element)            // select all text in element
Helper.urls2links(element, strict)    // auto-link URLs in element's innerHTML (DOMPurify sanitized)
Helper.sprintf(format, ...args)       // minimal %s/%d formatting
Helper.getCookie(name)                // get cookie value
Helper.baseUri()                      // cached origin+pathname (no query/hash)
Helper.htmlEntities(str)              // escape &<>"'`=/
Helper.calculateExpirationDate(date, secondsOrStr) // → Date object
Helper.formatBytes(bytes)             // → '1.5 MB'
Helper.PasteFactory(data)             // → new Paste(data)
Helper.CommentFactory(data)           // → new Comment(data)
Helper.isBootstrap5()                 // typeof bootstrap !== 'undefined'
```

---

## `I18n` Module — Client-Side Translations

```javascript
// Translate a string
I18n._('Document does not exist...')
I18n._('%d seconds remaining', 42)           // plural-aware
I18n._(element, 'Loading...')                // replaces element text + retries on lang load
I18n.translate(messageId, ...args)           // main implementation

// Language loading
I18n.loadLanguage('de')                      // async fetch of i18n/de.json
// Fires 'languageLoaded' DOM event when done

// Supported languages (client-side list):
['ar','bg','ca','co','cs','de','el','es','et','fa','fi','fr','he','hu',
 'id','it','ja','jbo','lt','no','nl','pl','pt','oc','ro','ru','sk','sl','sv','th','tr','uk','zh']
```

Translation files in `i18n/{lang}.json`:
```json
{
  "": { "plural-forms": "nplurals=2; plural=(n!=1);" },
  "Original English string": "Translated string",
  ["plural singular", "plural plural"]: ["translation singular", "translation plural"]
}
```

---

## `Model` Module — Client-Side State

```javascript
Model.getPasteId()            // extracts 16-hex id from URL query string
Model.getPasteKey()           // extracts base58 key from URL #fragment
Model.getPasteData(cb, useCache)  // fetches paste from server (caches result)
Model.getExpirationDefault()  // reads <select id="pasteExpiration"> value
Model.getFormatDefault()      // reads <select id="pasteFormatter"> value
Model.getTemplate()           // reads <body data-template> or cookie
Model.getSymmetricKey()       // returns cached or new 32-byte random key
Model.setSymmetricKey(key)    // override key (for password-change flow)
```

---

## `ServerInteraction` Module — XHR Wrapper

```javascript
ServerInteraction.prepare()           // reset state
ServerInteraction.setUrl(url)         // set request URL
ServerInteraction.setData(data)       // set JSON request body
ServerInteraction.setSuccess(fn)      // fn(status, data) on HTTP 200
ServerInteraction.setFailure(fn)      // fn(status, data) on error
ServerInteraction.run()               // execute fetch() request
ServerInteraction.parseUploadError(status, data, context)  // → human error string
```

Request uses `fetch()` with:
- `method: 'POST'` for create
- `headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'JSONHttpRequest' }`
- `body: JSON.stringify(data)`

---

## `AttachmentViewer` Module

Handles encrypted file attachments stored as base64 within the paste:

```javascript
// Detects MIME type and renders appropriately:
// image/*   → <img src="data:...">
// video/*   → <video src="...">
// audio/*   → <audio src="...">
// application/pdf → <iframe>
// other     → download link with filename
```

Attachment data is included inside `ct` (encrypted together with text content).

---

## Bundled Libraries

| Library | File | Version | Purpose |
|---------|------|---------|---------|
| zlib (WASM) | `js/zlib.js` + `js/zlib-1.3.2.js` | 1.3.2 | Deflate/inflate compression |
| base-x | `js/base-x-5.0.1.js` | 5.0.1 | Base58 encode/decode |
| Bootstrap | `js/bootstrap-5.3.8.js` | 5.3.8 | UI components (jQuery-free) |
| dark-mode-switch | `js/dark-mode-switch.js` | custom | Light/dark toggle (persists in cookie) |
| Google Prettify | `js/prettify.js` | fork | Syntax highlighting (100+ languages) |
| Showdown | `js/showdown-2.1.0.js` | 2.1.0 | Markdown → HTML conversion |
| DOMPurify | `js/purify-3.4.12.js` | 3.4.12 | XSS sanitization of rendered HTML |
| kjua | `js/kjua-0.10.0.js` | 0.10.0 | QR code generation (canvas-based) |
| legacy | `js/legacy.js` | custom | Backward compat for v1 paste format |

---

## Template System (`tpl/`)

### Template Files
| Template | Description |
|----------|-------------|
| `bootstrap5.php` | Main template — full feature set, dark mode, Bootstrap 5 |
| `shortenerproxy.php` | Minimal page for URL shortener proxy response |

### How Templates Work
1. `Controller::_view()` calls `View::assign(name, value)` for each variable
2. `View::draw('bootstrap5')` → `extract($variables)` → `include 'tpl/bootstrap5.php'`
3. Template accesses variables directly by name (e.g. `$DISCUSSION`, `$VERSION`)
4. Scripts loaded conditionally:
   - `kjua` only if `$QRCODE === true`
   - `prettify` only if `$SYNTAXHIGHLIGHTING === true`
   - `showdown` only if `$MARKDOWN === true`

### Key Body Attribute
```html
<body data-compression="zlib">
```
The JS reads `document.body.dataset.compression` to decide whether to compress.

---

## i18n System

### 39 Language Files in `i18n/`
```
ar bg ca co cs de el en es et fa fi fr he hi hu id it ja jbo
ko ku la lt nl no oc pl pt ro ru sk sl sv th tr uk zh
```

RTL languages: Arabic (`ar`), Hebrew (`he`), Farsi (`fa`), Kurdish (`ku`)

### PHP-Side i18n
- `I18n::_($msg, ...$args)` — printf-style, plural-aware
- `I18n::encode($str)` — HTML entity encoding for template output
- `I18n::getLanguage()` — detects from `lang` cookie → `languagedefault` config → `Accept-Language` header
- `I18n::isRtl()` — returns true for RTL languages (adds `dir="rtl"` to `<html>`)
- `I18n::getAvailableLanguages()` — scans `i18n/` directory

### Translation File Format
```json
{
  "": { "plural-forms": "nplurals=2; plural=(n!=1);" },
  "Document does not exist, has expired or has been deleted.": "...",
  ["Please wait %d seconds...", "Please wait %d seconds..."]: [
    "Please wait %d second between each post.",
    "Please wait %d seconds between each post."
  ]
}
```

---

## DOMPurify Configuration

```javascript
// For general HTML (markdown output)
const purifyHtmlConfig = {
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|magnet):)/i,
  ALLOWED_ATTR: ['href', 'id', 'target', 'rel', 'class', 'style'],
  USE_PROFILES: { html: true }
};

// For strict subset (URLs in plaintext mode)
const purifyHtmlConfigStrictSubset = {
  ALLOWED_URI_REGEXP: purifyHtmlConfig.ALLOWED_URI_REGEXP,
  ALLOWED_TAGS: ['a', 'i', 'span', 'kbd'],
  ALLOWED_ATTR: ['href', 'id', 'target', 'rel'],
  ADD_ATTR: ['target', 'rel']
};

// For SVG content
const purifySvgConfig = {
  USE_PROFILES: { svg: true, svgFilters: true }
};
```

All auto-linked URLs get: `target="_blank" rel="nofollow noopener noreferrer"`
