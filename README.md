# 🐛 Bug Reporter for FreeScout

A powerful Chrome extension that allows users to quickly capture **screenshots** or **screen recordings with audio** and send them directly to **FreeScout** as bug reports.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![License](https://img.shields.io/badge/license-MIT-orange)

---

## ✨ Features

- 📸 **Screenshot Capture** - Capture the current browser tab instantly
- 🎥 **Screen Recording** - Record screen with microphone audio (up to 30 seconds)
- 📝 **Rich Bug Reports** - Add detailed descriptions, titles, priority, and type
- 🚀 **Direct FreeScout Integration** - No email needed, reports go straight to FreeScout
- 🎨 **Beautiful Modern UI** - Clean, intuitive interface with smooth animations
- ⚙️ **Customizable Settings** - Configure video quality, recording time, and more
- 🔒 **Privacy First** - All data goes directly from browser to FreeScout (no third-party storage)
- 📊 **Automatic Context** - Captures page URL, browser info, and timestamp

---

## 🚀 Installation

### Method 1: Load Unpacked Extension (Development)

1. **Download or Clone** this repository
2. Open **Chrome** and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the extension folder
6. The Bug Reporter icon should appear in your toolbar

### Method 2: Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store once published.

---

## ⚙️ Configuration

Before using the extension, you need to configure it with your FreeScout credentials.

### Step 1: Get FreeScout API Credentials

1. Log into your **FreeScout admin panel**
2. Navigate to **Manage → Settings → API**
3. Generate a new **API Key** (copy it securely)
4. Navigate to **Manage → Mailboxes**
5. Note the **Mailbox ID** (usually a number like `1`, `2`, etc.)

### Step 2: Configure the Extension

1. Click the **Bug Reporter** extension icon
2. Click the **Settings** (⚙️) button
3. Enter your details:
   - **FreeScout URL**: Your FreeScout installation URL (e.g., `https://support.example.com`)
   - **API Key**: The API key from Step 1
   - **Mailbox ID**: The mailbox ID where bug reports will be created
   - **Default Assignee** (Optional): Email of the user to auto-assign tickets
4. Configure recording settings:
   - **Record microphone audio**: Enable/disable audio recording
   - **Max recording time**: Set between 5-60 seconds (default: 30)
   - **Video quality**: Choose Low, Medium, or High
5. Click **Save Settings**

---

## 📖 How to Use

### Capturing a Screenshot

1. Click the **Bug Reporter** icon
2. Click **Screenshot** button
3. The current tab will be captured
4. Add bug details (title, description, priority, type)
5. Click **Submit Bug Report**

### Recording a Screen Video

1. Click the **Bug Reporter** icon
2. Click **Record Video** button
3. Choose what to share:
   - **Your Entire Screen** - Record everything
   - **Application Window** - Record a specific window
   - **Chrome Tab** - Record just a browser tab
4. Click **Share** in the browser dialog
5. The extension will start recording (max 30 seconds)
6. Click **Stop Recording** when done (or it auto-stops)
7. Preview the video
8. Add bug details (title, description, priority, type)
9. Click **Submit Bug Report**

### Bug Report Fields

- **Bug Title**: Brief summary (e.g., "Login button not working")
- **Description**: Detailed explanation, steps to reproduce, expected vs actual behavior
- **Priority**: Low, Medium, or High
- **Type**: Bug, Feature Request, or Improvement

---

## 🛠️ Technical Details

### Built With

- **Chrome Extension API** (Manifest V3)
- **MediaRecorder API** - For screen recording
- **chrome.tabCapture** - For tab capture
- **chrome.desktopCapture** - For screen + audio capture
- **FreeScout REST API** - For ticket creation

### Permissions Required

- `activeTab` - Capture current tab screenshot
- `tabCapture` - Record tab video
- `desktopCapture` - Record screen with audio
- `storage` - Save extension settings
- `scripting` - Inject capture scripts
- `<all_urls>` - Access any page for screenshot (required by Chrome API)

### File Size Limits

- **Max recording time**: 60 seconds (default: 30s)
- **Max file size**: 50 MB (FreeScout upload limit)
- Videos are automatically encoded to stay within limits

### Browser Support

- ✅ **Google Chrome** 88+
- ✅ **Microsoft Edge** 88+ (Chromium-based)
- ✅ **Brave Browser**
- ✅ **Other Chromium-based browsers**

---

## 📁 Project Structure

```
Alexander Extension/
├── manifest.json           # Extension manifest (Manifest V3)
├── popup.html             # Main popup UI
├── popup.js               # Main popup logic
├── background.js          # Service worker for permissions
├── styles.css             # Beautiful modern styles
├── config.js              # Settings management
├── freescout-api.js       # FreeScout API integration
├── README.md              # This file
└── icons/                 # Extension icons (to be added)
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## 🎨 Creating Icons

The extension needs icon files. Here are the required sizes:

- `icons/icon16.png` - 16x16 pixels
- `icons/icon32.png` - 32x32 pixels
- `icons/icon48.png` - 48x48 pixels
- `icons/icon128.png` - 128x128 pixels

**Icon Design Tips:**

- Use a bug icon (🐛) or a camera/video icon
- Make it recognizable at small sizes
- Use your brand colors
- Export as PNG with transparency

**Quick Icon Creation:**

1. Use a tool like [Figma](https://figma.com), [Canva](https://canva.com), or [Photopea](https://photopea.com)
2. Create a 128x128 design
3. Export at all required sizes
4. Place in the `icons/` folder

---

## 🔧 Troubleshooting

### "Settings not configured" error

**Solution**: Open settings and enter your FreeScout URL, API Key, and Mailbox ID.

### Recording won't start

**Solution**:

- Check microphone permissions in Chrome settings
- Make sure you clicked "Share" in the screen share dialog
- Try reloading the extension

### "Failed to upload attachment" error

**Solution**:

- Check your file size (must be < 50 MB)
- Verify FreeScout API key is correct
- Ensure your FreeScout installation allows API uploads

### Video file too large

**Solution**:

- Reduce recording time (Settings → Max Recording Time)
- Lower video quality (Settings → Video Quality → Low)
- Record a smaller screen area (choose "Chrome Tab" instead of "Entire Screen")

### API Connection Failed

**Solution**:

- Verify FreeScout URL is correct (include `https://`)
- Check API key hasn't expired
- Ensure mailbox ID exists in your FreeScout installation
- Check CORS settings in FreeScout if self-hosted

---

## 🔐 Privacy & Security

- ✅ **No external servers** - Data goes directly from your browser to FreeScout
- ✅ **No tracking** - No analytics or tracking scripts
- ✅ **Secure storage** - Settings stored in Chrome's encrypted storage
- ✅ **No cloud uploads** - Media never touches third-party services
- ✅ **API key protection** - API key stored securely and never logged

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 Roadmap

Future enhancements planned:

- [ ] Area selection for screenshots
- [ ] Drawing tools (arrows, text, highlights)
- [ ] GIF recording option
- [ ] Multiple file attachments
- [ ] Custom fields for bug reports
- [ ] Keyboard shortcuts
- [ ] Dark mode support
- [ ] Export reports as JSON
- [ ] Integration with other helpdesk systems

---

## 📄 License

This project is licensed under the MIT License.

---

## 💬 Support

For issues, questions, or feature requests:

- **GitHub Issues**: [Create an issue](https://github.com/yourusername/bug-reporter/issues)
- **Email**: support@example.com
- **FreeScout Docs**: [FreeScout API Documentation](https://github.com/freescout-helpdesk/freescout/wiki/API)

---

## 🙏 Acknowledgments

- Built with ❤️ for better bug reporting
- Inspired by the need for simple, direct bug reporting tools
- Thanks to the FreeScout community for the excellent helpdesk software

---

**Made with 🐛 by Your Team**

_Bug reporting made simple!_
