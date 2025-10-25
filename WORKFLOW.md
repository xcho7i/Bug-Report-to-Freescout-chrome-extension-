# 🔄 Bug Reporter Workflow

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Browser                          │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │          Bug Reporter Extension                    │    │
│  │                                                     │    │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐       │    │
│  │  │ popup.   │  │ background│  │  config.  │       │    │
│  │  │ html/js  │◄─┤    .js    │◄─┤    js     │       │    │
│  │  └────┬─────┘  └──────────┘  └───────────┘       │    │
│  │       │                                            │    │
│  │       ▼                                            │    │
│  │  ┌──────────────┐         ┌─────────────┐        │    │
│  │  │ freescout-   │────────►│  FreeScout  │        │    │
│  │  │   api.js     │  HTTPS  │     API     │        │    │
│  │  └──────────────┘         └─────────────┘        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎬 User Flow - Screenshot Capture

```
1. User clicks extension icon
   ↓
2. Popup opens → Shows capture options
   ↓
3. User clicks "Screenshot" button
   ↓
4. popup.js → Sends message to background.js
   ↓
5. background.js → Captures visible tab
   ↓
6. Returns data URL to popup.js
   ↓
7. Converts to Blob
   ↓
8. Shows preview + form
   ↓
9. User fills in bug details
   ↓
10. Clicks "Submit"
   ↓
11. freescout-api.js → Creates conversation
   ↓
12. freescout-api.js → Uploads attachment
   ↓
13. Shows success message
   ↓
14. Ticket created in FreeScout! ✅
```

---

## 🎥 User Flow - Video Recording

```
1. User clicks extension icon
   ↓
2. Popup opens → Shows capture options
   ↓
3. User clicks "Record Video" button
   ↓
4. popup.js → Requests screen stream ID
   ↓
5. background.js → Calls chrome.desktopCapture
   ↓
6. Browser shows "Share your screen" dialog
   ↓
7. User selects screen/window/tab → Clicks "Share"
   ↓
8. Returns stream ID
   ↓
9. popup.js → Gets media stream with video
   ↓
10. Requests microphone access (if enabled)
    ↓
11. Combines video + audio streams
    ↓
12. Starts MediaRecorder
    ↓
13. Shows recording UI with timer
    ↓
14. Records for up to 30 seconds (or user stops)
    ↓
15. Stops recording → Creates Blob
    ↓
16. Checks file size (< 50 MB)
    ↓
17. Shows preview + form
    ↓
18. User fills in bug details
    ↓
19. Clicks "Submit"
    ↓
20. freescout-api.js → Creates conversation
    ↓
21. freescout-api.js → Uploads video attachment
    ↓
22. Shows success message
    ↓
23. Ticket with video created in FreeScout! ✅
```

---

## 🔧 Settings Configuration Flow

```
1. User clicks Settings icon (⚙️)
   ↓
2. Settings view opens
   ↓
3. User enters:
   • FreeScout URL
   • API Key
   • Mailbox ID
   • Optional: Default Assignee
   • Recording preferences
   ↓
4. Clicks "Save Settings"
   ↓
5. config.js → Validates input
   ↓
6. If valid:
   ├─► Saves to chrome.storage.sync
   ├─► Shows success notification
   └─► Returns to main view
   ↓
7. If invalid:
   └─► Shows error message
       └─► User corrects and retries
```

---

## 📡 API Communication Flow

```
Extension                          FreeScout Server
    │                                     │
    │  1. POST /api/conversations         │
    ├────────────────────────────────────►│
    │  Headers:                           │
    │  - X-FreeScout-API-Key: xxx        │
    │  Body:                              │
    │  - subject, type, status           │
    │  - customer info                    │
    │  - threads (bug description)       │
    │                                     │
    │  2. Response: Conversation created  │
    │◄────────────────────────────────────┤
    │  { id: 123, ... }                  │
    │                                     │
    │  3. POST /api/conversations/123/    │
    │            attachments              │
    ├────────────────────────────────────►│
    │  Headers:                           │
    │  - X-FreeScout-API-Key: xxx        │
    │  Body: FormData                     │
    │  - file: blob (image/video)        │
    │                                     │
    │  4. Response: Attachment uploaded   │
    │◄────────────────────────────────────┤
    │  { success: true }                 │
    │                                     │
    │  ✅ Complete!                       │
```

---

## 🔐 Data Flow & Privacy

```
┌──────────────┐
│   Browser    │  All processing happens locally
│    Memory    │  No external servers involved
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Extension   │  Captures screenshot/video
│   Storage    │  Stores settings locally
└──────┬───────┘
       │
       │  HTTPS only
       │  Direct connection
       │
       ▼
┌──────────────┐
│  FreeScout   │  Your server
│    Server    │  You control the data
└──────────────┘

NO THIRD-PARTY SERVICES
NO CLOUD STORAGE
NO TRACKING
```

---

## 🎯 File Interaction Map

```
manifest.json
    ├── Defines permissions
    ├── References popup.html
    └── References background.js

popup.html
    ├── Loads styles.css
    ├── Loads config.js
    ├── Loads freescout-api.js
    └── Loads popup.js

popup.js
    ├── Uses config.js for settings
    ├── Uses freescout-api.js for submissions
    └── Communicates with background.js

background.js
    ├── Handles screen capture permissions
    └── Responds to popup.js messages

config.js
    └── Manages chrome.storage.sync

freescout-api.js
    └── Makes HTTPS calls to FreeScout
```

---

## ⚡ Performance Timeline

```
Screenshot Capture:
[0ms]     User clicks "Screenshot"
[50ms]    Send message to background
[200ms]   Capture tab screenshot
[300ms]   Convert to blob
[350ms]   Display preview
[350ms+]  User fills form
[???]     User clicks submit
[+1s]     Create FreeScout ticket
[+2s]     Upload attachment
[+2.5s]   Show success ✅

Total: ~3-4 seconds (depending on network)

Video Recording:
[0ms]     User clicks "Record"
[100ms]   Request stream ID
[500ms]   User selects screen
[800ms]   Get media stream
[1000ms]  Start recording
[1000ms-30s] Recording...
[+100ms]  Process video blob
[+200ms]  Check file size
[+300ms]  Display preview
[+???]    User fills form
[+???]    User clicks submit
[+3s]     Create ticket & upload
[+5s]     Show success ✅

Total: 30-40 seconds (including recording time)
```

---

## 🧩 Extension Components

```
┌─────────────────────────────────────────┐
│           User Interface Layer           │
├─────────────────────────────────────────┤
│  • popup.html (Structure)               │
│  • styles.css (Design)                  │
│  • popup.js (Interactions)              │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│          Business Logic Layer            │
├─────────────────────────────────────────┤
│  • config.js (Settings)                 │
│  • freescout-api.js (API Client)        │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│          System Layer                    │
├─────────────────────────────────────────┤
│  • background.js (Service Worker)       │
│  • Chrome APIs (Capture, Storage)       │
└─────────────────────────────────────────┘
```

---

## 🚀 Quick Reference

### Key Functions

| Function              | File             | Purpose                    |
| --------------------- | ---------------- | -------------------------- |
| `captureScreenshot()` | popup.js         | Capture current tab        |
| `startRecording()`    | popup.js         | Begin screen recording     |
| `stopRecording()`     | popup.js         | Stop and process recording |
| `submitBugReport()`   | popup.js         | Submit to FreeScout        |
| `createTicket()`      | freescout-api.js | Create conversation        |
| `uploadAttachment()`  | freescout-api.js | Upload media file          |
| `getSettings()`       | config.js        | Load settings              |
| `saveSettings()`      | config.js        | Store settings             |

### Key Events

| Event            | Trigger     | Handler               |
| ---------------- | ----------- | --------------------- |
| Screenshot click | User action | `captureScreenshot()` |
| Record click     | User action | `startRecording()`    |
| Stop recording   | User/timer  | `stopRecording()`     |
| Submit click     | User action | `submitBugReport()`   |
| Settings save    | User action | `saveSettings()`      |

---

**📘 For detailed implementation, see the source files!**
