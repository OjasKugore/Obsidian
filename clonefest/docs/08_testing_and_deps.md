# Module 08 — Testing, Dependencies & Deployment

> Read when setting up tests, CI/CD, or auditing dependencies.

---

## PHP Tests (`tst/`)

Run: `php vendor/bin/phpunit --configuration tst/phpunit.xml`

| Test File | Coverage |
|-----------|----------|
| `ControllerTest.php` | Full HTTP lifecycle, all operations, error paths |
| `ControllerWithDbTest.php` | Controller with Database (SQLite) backend |
| `ControllerWithGcsTest.php` | Controller with GCS backend (mocked) |
| `JsonApiTest.php` | JSON API contract tests (all endpoints) |
| `ModelTest.php` | Paste/Comment CRUD across all 4 backends |
| `ConfigurationTest.php` | Config parsing, defaults, missing sections, type coercion |
| `RequestTest.php` | HTTP parsing, content negotiation, operation detection |
| `FilterTest.php` | Input sanitization edge cases |
| `FormatV2Test.php` | Paste format validation — all valid and invalid inputs |
| `I18nTest.php` | Translation loading, language detection, plurals, RTL |
| `ViewTest.php` | Template rendering, SRI hashes, cache busters |
| `Vizhash16x16Test.php` | Vizhash icon generation output |
| `YourlsProxyTest.php` | YOURLS proxy request/response flow |
| `ShlinkProxyTest.php` | Shlink proxy request/response flow |
| `MigrateTest.php` | Filesystem migration (legacy → protected format) |
| `AdministrationOptionsTest.php` | CLI administration options |

---

## JavaScript Tests (`js/test/`)

Run: `npm test`
Coverage: `nyc npm test`
CI output: `npm run ci-test` (JUnit XML → `mocha-results.xml`)

**Framework:** Mocha 11  
**DOM:** jsdom 26 + jsdom-global  
**Crypto:** @peculiar/webcrypto (Web Crypto polyfill for Node.js)  
**Property-based:** fast-check 4  
**Coverage:** NYC/Istanbul (`js/.nycrc.yml`)  
**Linting:** ESLint 9 (`js/eslint.config.js`) + JSHint (`.jshintrc`)

---

## PHP Composer Dependencies

### Required
| Package | Version | Purpose |
|---------|---------|---------|
| `php` | `^7.4 \|\| ^8.0` | Runtime |
| `jdenticon/jdenticon` | `2.0.0` | SVG/PNG Jdenticon generation |
| `yzalis/identicon` | `2.0.0` | Alternative Identicon style |
| `mlocati/ip-lib` | `1.22.0` | IPv4/IPv6/CIDR parsing for rate limiting |
| `symfony/polyfill-php80` | `1.34.0` | PHP 8.0 backport for PHP 7.4 |

### Optional (cloud storage)
| Package | Version | Purpose |
|---------|---------|---------|
| `google/cloud-storage` | `1.45.0` | GCS backend |
| `aws/aws-sdk-php` | `3.336.2` | S3 backend |

### Dev
| Package | Version | Purpose |
|---------|---------|---------|
| `phpunit/phpunit` | `^9` | PHP unit + integration testing |

---

## JavaScript npm Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@peculiar/webcrypto` | `^1.5.0` | WebCrypto polyfill for Node.js tests |
| `eslint` | `^9.37.0` | JS linting |
| `fast-check` | `^4.7.0` | Property-based testing |
| `jsdom` | `^26.1.0` | DOM simulation |
| `jsdom-global` | `^3.0.2` | Global DOM setup for Mocha |
| `mime-types` | `^3.0.2` | MIME type lookup in tests |
| `mocha` | `^11.7.5` | Test runner |
| `nyc` | `^18.0.0` | Code coverage |

---

## Makefile Targets

```makefile
make          # default (lint + test)
make test     # run PHP + JS tests
make lint     # PHP (phpcs) + JS (eslint + jshint)
```

---

## Deployment

### Heroku / Heroku-compatible (Procfile)
```
web: vendor/bin/heroku-php-nginx -C nginx.conf .
```

### Docker / DevContainer
- `.devcontainer/` — VSCode DevContainer config
- `CONFIG_PATH` env var points to config directory outside container
- `PRIVATEBIN_GCS_BUCKET` for GCS bucket name

### JetBrains
- `.run/` — pre-configured run/debug configurations

### Nginx Config (`nginx.conf`)
Included in the repo. Key rules:
- All requests route through `index.php`
- `data/` directory is blocked from direct access
- PHP files in `data/` return 403 via the protection line

### Apache
- `.htaccess` in `data/` auto-generated: `Require all denied`

---

## SRI Hash Regeneration

When bundled JS files change, regenerate SRI hashes:

```bash
# For each JS file:
sha512sum js/privatebin.js | awk '{print $1}' | xxd -r -p | base64
# Or:
openssl dgst -sha512 -binary js/privatebin.js | base64
```

Then update `[sri]` section in `cfg/conf.php`.
