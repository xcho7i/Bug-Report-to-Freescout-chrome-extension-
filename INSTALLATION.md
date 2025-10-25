# 🚀 Installation Guide - Bug Reporter Extension

## Quick Start (5 Minutes)

### Step 1: Generate Icons

Before loading the extension, you need to generate the required icon files.

1. **Open the Icon Generator:**

   - Open the `icon-generator.html` file in your browser
   - Or double-click it from the file explorer

2. **Download Icons:**
   - Click **"Download All Icons as ZIP"** button
   - Or download each icon individually (16px, 32px, 48px, 128px)
3. **Place Icons:**
   - Save all downloaded icons to the `icons/` folder
   - You should have:
     - `icons/icon16.png`
     - `icons/icon32.png`
     - `icons/icon48.png`
     - `icons/icon128.png`

### Step 2: Load Extension in Chrome

1. **Open Chrome Extensions Page:**

   - Navigate to `chrome://extensions/`
   - Or: Menu (⋮) → More Tools → Extensions

2. **Enable Developer Mode:**

   - Toggle **"Developer mode"** switch in the top-right corner

3. **Load Unpacked Extension:**

   - Click **"Load unpacked"** button
   - Select the **"Alexander Extension"** folder (the entire project folder)
   - Click **"Select Folder"**

4. **Verify Installation:**
   - You should see "Bug Reporter for FreeScout" in your extensions list
   - The bug icon should appear in your Chrome toolbar
   - If you don't see it, click the puzzle icon (🧩) and pin the extension

### Step 3: Configure FreeScout Settings

Before you can submit bug reports, configure the extension:

1. **Get FreeScout API Credentials:**

   - Log into your FreeScout admin panel
   - Go to **Manage → Settings → API**
   - Click **"Generate API Key"**
   - Copy the API key (you'll need it in the next step)
   - Go to **Manage → Mailboxes**
   - Note the **Mailbox ID** (usually `1`, `2`, etc.)

2. **Configure the Extension:**

   - Click the Bug Reporter icon in Chrome toolbar
   - Click the **Settings** (⚙️) button
   - Fill in:
     - **FreeScout URL**: `https://your-freescout-domain.com`
     - **API Key**: Paste the key from step 1
     - **Mailbox ID**: Enter the mailbox ID (e.g., `1`)
     - **Default Assignee** (Optional): `developer@example.com`
   - Click **"Save Settings"**

3. **Test the Connection:**
   - The extension will validate your settings
   - If successful, you'll see "Settings saved successfully!"

### Step 4: Create Your First Bug Report

1. **Open a webpage** you want to report a bug on

2. **Click the Bug Reporter icon**

3. **Choose capture method:**

   - **Screenshot**: Instant capture of current tab
   - **Record Video**: Record up to 30 seconds with audio

4. **Add bug details:**

   - Bug Title: Brief summary
   - Description: Detailed explanation
   - Priority: Low/Medium/High
   - Type: Bug/Feature/Improvement

5. **Submit:**
   - Click **"Submit Bug Report"**
   - Wait for confirmation
   - Check FreeScout for the new ticket!

---

## Troubleshooting

### Icons Not Showing

**Problem:** Extension loaded but no icon appears

**Solution:**

1. Make sure you generated all 4 icon files
2. Verify files are in the `icons/` folder
3. File names must be exact: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
4. Reload the extension: Go to `chrome://extensions/` and click the refresh icon (🔄)

### "Settings Not Configured" Error

**Problem:** Can't capture bugs, settings error message

**Solution:**

1. Click the Settings (⚙️) button
2. Fill in all required fields (FreeScout URL, API Key, Mailbox ID)
3. Make sure FreeScout URL includes `https://`
4. Verify API key is correct (copy-paste from FreeScout)
5. Click "Save Settings"

### Recording Won't Start

**Problem:** Clicked "Record Video" but nothing happens

**Solution:**

1. When the browser asks to share screen, make sure to click **"Share"**
2. Check microphone permissions:
   - Go to `chrome://settings/content/microphone`
   - Make sure Chrome can access microphone
3. Try reloading the extension
4. Restart Chrome if issue persists

### "API Request Failed" Error

**Problem:** Can't submit bug reports to FreeScout

**Solution:**

1. **Check FreeScout URL:**

   - Must include protocol: `https://support.example.com`
   - No trailing slash
   - URL must be accessible from your computer

2. **Verify API Key:**

   - Log into FreeScout
   - Go to Manage → Settings → API
   - Regenerate key if needed
   - Copy the ENTIRE key (no spaces)

3. **Confirm Mailbox ID:**

   - Go to Manage → Mailboxes
   - Click on the mailbox
   - The ID is in the URL: `...mailbox/view/1` (ID is `1`)

4. **Check CORS (Self-hosted FreeScout):**
   - If self-hosted, you may need to configure CORS
   - Add your extension's origin to allowed origins
   - See FreeScout documentation for CORS setup

### File Too Large Error

**Problem:** "Recording is too large" message

**Solution:**

1. **Reduce recording time:**
   - Settings → Max Recording Time → Set to 15-20 seconds
2. **Lower video quality:**
   - Settings → Video Quality → Select "Low"
3. **Record smaller area:**
   - Choose "Chrome Tab" instead of "Entire Screen"
4. **Check file size:**
   - Max allowed: 50 MB
   - If still too large, record shorter clips

---

## Advanced Configuration

### Custom Video Quality Settings

Adjust video quality based on your needs:

- **Low Quality** (720p, 15fps): Best for fast uploads, smaller files
- **Medium Quality** (1080p, 24fps): Balanced quality and size ⭐ Recommended
- **High Quality** (1440p, 30fps): Best quality, larger files

### Recording Time Limits

- **Minimum:** 5 seconds
- **Maximum:** 60 seconds
- **Default:** 30 seconds (recommended)

### Audio Settings

- **Record Microphone Audio:** Capture your voice while recording (recommended)
- **Record System Audio:** Capture browser audio (experimental, may not work on all systems)

---

## Updating the Extension

When a new version is available:

1. Download the new files
2. Replace old files with new ones
3. Go to `chrome://extensions/`
4. Click the refresh icon (🔄) on the Bug Reporter extension
5. Your settings will be preserved

---

## Uninstalling

To remove the extension:

1. Go to `chrome://extensions/`
2. Find "Bug Reporter for FreeScout"
3. Click **"Remove"**
4. Confirm removal

Your settings will be deleted automatically.

---

## Support

Need help? Check these resources:

- **README.md**: Full documentation
- **FreeScout API Docs**: https://github.com/freescout-helpdesk/freescout/wiki/API
- **GitHub Issues**: Report bugs or request features

---

**🎉 You're all set! Start reporting bugs efficiently!**
