---
description: How to safely package OTA update zips for Capgo/Capacitor
---

# Capgo OTA Update Packaging Rule

**CRITICAL:** When instructed to generate, pack, or compress an OTA update zip for Capgo (usually `update.zip`), you MUST NEVER use PowerShell's `Compress-Archive` or any native Windows zipping utilities.

## Why?
PowerShell's `Compress-Archive` strips essential cross-platform Unix file permissions and uses Windows-specific internal pathing. While the zip will look fine on Windows and successfully transfer over HTTP, Android and iOS native unzippers (`java.util.zip`) will reject it as corrupted, causing the Capgo plugin to throw an `OTA Download Failed` error on the user's mobile device.

## The Correct Way
You MUST always use Node's `adm-zip` library (which is already installed in the `server` directory) to generate the zip file. 

To package an OTA update:
1. Ensure the frontend is built (`cd client && npm run build`).
2. The `index.html` file must sit exactly at the root of the zip file (not inside a nested `dist` folder).
3. Run the existing `server/pack_ota.cjs` script, or use the following Node.js snippet:

```javascript
const AdmZip = require("adm-zip");
const path = require("path");

const zip = new AdmZip();
// Adds the CONTENTS of client/dist to the root of the zip
zip.addLocalFolder(path.resolve(__dirname, "../client/dist"));
zip.writeZip(path.resolve(__dirname, "src/uploads/update.zip"));
console.log("Successfully generated update.zip with proper cross-platform headers!");
```
