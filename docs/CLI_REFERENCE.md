# 🛡️ Obsidian CLI — Command Reference

The **Obsidian CLI** brings End-to-End Encryption (E2EE) and zero-knowledge data sharing directly to your command line.

---

## ⚡ Commands

| Purpose | Command |
| :--- | :--- |
| **Send a quick secret (burns on read)** | `npm run dev -- send "my secret password"` |
| **Send secret (keeps alive, doesn't burn)** | `npm run dev -- send "team wifi pass" --no-burn` |
| **Send a file** | `npm run dev -- send --file ./database.env` |
| **Read & decrypt any paste link** | `npm run dev -- read "http://localhost:3000/pasteId#key"` |
| **Generate my personal RSA identity key** | `npm run dev -- key generate` |
| **Get my public key to give to someone** | `npm run dev -- key show --public` |
| **Send secret to a specific person** | `npm run dev -- send "classified" --recipient "PASTE_PUBLIC_KEY_HERE"` |
| **Create a 2-of-3 Team Quorum (Shamir)** | `npm run dev -- send "root password" --shares 3 --threshold 2` |
| **Decrypt Shamir paste with 2 shards** | `npm run dev -- read "<shard1_url>" --shards "<shard2_url>"` |
| **Encrypt & send an entire folder / repo** | `npm run dev -- repo send ./my-app --recipient "PASTE_PUBLIC_KEY_HERE"` |
| **Download & decrypt a whole repo** | `npm run dev -- repo get "http://localhost:3000/repoId#asym" --output ./my-app` |
| **Split a password locally (offline)** | `npm run dev -- shamir split "super-secret" --shares 3 --threshold 2` |
| **Recombine local shards (offline)** | `npm run dev -- shamir combine "shard-1-..." "shard-2-..."` |

> 💡 **PowerShell Tip:** Always wrap URLs and public keys in double quotes `" "` so PowerShell does not misinterpret special characters like `#` or `=`.

---

## 🚀 Setup & First Run

Navigate into the `cli` folder and install dependencies once:

```powershell
cd c:\Users\chenn\OneDrive\Desktop\phase2\obsidian\cli
npm install
```

To see all built-in commands at any time:
```powershell
npm run dev -- --help
```

---

## 📖 Scenario 1: Standard Secret Sharing (Symmetric Mode)

Use this when you want to encrypt a password, API key, or file and get a link to share with anyone.

### Step 1: Encrypt & Upload
```powershell
# Burns immediately after first view (Default)
npm run dev -- send "sk_live_998822334455"

# OR persist without burning:
npm run dev -- send "sk_live_998822334455" --no-burn

# OR upload directly from a file:
npm run dev -- send --file ./secrets.env
```

**Output:**
```
  Paste ID        : e6b1b9e40ca91106
  Mode            : 🔑 Symmetric (AES-256-GCM)
  Burn After      : Yes
  🔗 Share Link   : http://localhost:3000/e6b1b9e40ca91106#889e9bpudUWUTKj...
```

### Step 2: Decrypt & View
```powershell
npm run dev -- read "http://localhost:3000/e6b1b9e40ca91106#889e9bpudUWUTKj..."
```

---

## 🔐 Scenario 2: Single-User Asymmetric (RSA-OAEP)

Use this when you want to send a secret that **only one specific person's computer** can decrypt. The private key never leaves their machine.

### Step 1: Recipient generates and shares their public key
```powershell
# Recipient runs this once:
npm run dev -- key generate

# Recipient copies their public key:
npm run dev -- key show --public
```

### Step 2: Sender encrypts using the recipient's public key
```powershell
npm run dev -- send "Confidential Financial Report" --recipient "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA..."
```
*Outputs:* `http://localhost:3000/dbb274248d07edf4#asym`

### Step 3: Recipient decrypts with their local identity key
```powershell
npm run dev -- read "http://localhost:3000/dbb274248d07edf4#asym"
```

---

## 👥 Scenario 3: Multi-User Quorum (Shamir Secret Sharing)

Use this when a secret requires **team consensus** (e.g. at least 2 out of 3 executives must agree to decrypt).

### Step 1: Create a 2-of-3 Quorum Paste
```powershell
npm run dev -- send "Master Database Encryption Key" --shares 3 --threshold 2
```

**Output:**
```
  🧩 Generated 3 Shard Links (Any 2 required to decrypt):

  [Shard #1 of 3]
  http://localhost:3000/240e82e4edc3450d#shard-2-1-3-5efb33c8a6d...

  [Shard #2 of 3]
  http://localhost:3000/240e82e4edc3450d#shard-2-2-3-140ff1e04c1...

  [Shard #3 of 3]
  http://localhost:3000/240e82e4edc3450d#shard-2-3-3-dbaa46f8e35...
```
*Give one link to Alice, one to Bob, and one to Charlie.*

### Step 2: What happens if only 1 person opens their link?
```powershell
npm run dev -- read "http://localhost:3000/240e82e4edc3450d#shard-2-1-3-5efb33c8a6d..."
```
**Output:**
```
  🔒 Shamir Quorum Required (1/2 shards provided)
  Threshold (k)   : 2 shards needed
  Provided        : 1 shard(s) [Shard #1]

  To decrypt, supply the remaining shard URL(s):
  npm run dev -- read "<url1>" --shards "<second-shard-url>"
```

### Step 3: Quorum Decryption (Alice + Charlie combine their shards)
```powershell
npm run dev -- read "http://localhost:3000/240e82e4edc3450d#shard-2-1-3-5efb33c8a6d..." --shards "http://localhost:3000/240e82e4edc3450d#shard-2-3-3-dbaa46f8e35..."
```
**Output:**
```
  √ Lagrange interpolation complete — AES-256 key recovered
  √ Decrypted successfully: Master Database Encryption Key
```

---

## 📦 Scenario 4: Whole-Repository / Folder Sharing

Use this to securely package, compress (respecting `.gitignore`), encrypt, and send an entire folder or repository.

### Step 1: Encrypt and Upload Folder
```powershell
npm run dev -- repo send ./my-project --recipient "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8A..."
```
*Outputs:* `http://localhost:3000/982a17f6#asym`

### Step 2: Download, Decrypt, and Extract
```powershell
npm run dev -- repo get "http://localhost:3000/982a17f6#asym" --output ./recovered-project
```

---

## 🧰 Scenario 5: Offline Shamir Secret Splitting (No Server)

Split arbitrary passwords or tokens locally without sending any data over the network.

### Split Secret:
```powershell
npm run dev -- shamir split "my-recovery-phrase" --shares 3 --threshold 2
```

### Combine Shards:
```powershell
npm run dev -- shamir combine "shard-2-1-3-ac7632..." "shard-2-3-3-294294..."
```

---

## ⚙️ Configuration Commands

| Purpose | Command |
| :--- | :--- |
| Check current server URL (Default: `http://localhost:3000`) | `npm run dev -- config get-url` |
| Point CLI to a deployed server (e.g. `https://obsidian.example.com`) | `npm run dev -- config set-url <url>` |
| Reset server configuration to default | `npm run dev -- config reset` |
