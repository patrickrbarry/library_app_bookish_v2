# 📚 Bookish Library v2

Clean, modular rebuild of the Bookish Library personal book tracker.

## 🎯 Features

- ✅ Track books across multiple formats (Physical, Kindle, Audible)
- ✅ Advanced search and filtering
- ✅ ISBN lookup with auto-fill (uses Vercel API)
- ✅ Import/Export JSON backups
- ✅ Progressive Web App (installable on iPhone)
- ✅ Warm brown color scheme optimized for iPhone 13 mini

## 📁 Project Structure

```
library_app_bookish_v2/
├── index.html              # Main UI
├── manifest.json           # PWA configuration
├── css/
│   └── styles.css          # All styles
├── js/
│   ├── app.js             # Main application logic
│   ├── data.js            # Data management & localStorage
│   ├── ui.js              # UI rendering & updates
│   ├── api.js             # ISBN lookup API
│   └── utils.js           # Utility functions
└── icons/
    ├── icon-192x192.png   # App icon (192x192)
    └── icon-512x512.png   # App icon (512x512)
```

## 🚀 Deployment to Netlify

### Step 1: Copy to Your Mac

```bash
# On your Mac
cd ~
# Copy the entire library_app_bookish_v2 folder from wherever you downloaded it
```

### Step 2: Add Icons

Copy your existing icons:
```bash
cp ~/library_app_bookish/icon-192x192.png ~/library_app_bookish_v2/icons/
cp ~/library_app_bookish/icon-512x512.png ~/library_app_bookish_v2/icons/
```

### Step 3: Initialize Git

```bash
cd ~/library_app_bookish_v2
git init
git add .
git commit -m "Initial commit - Bookish Library v2"
```

### Step 4: Push to GitHub

```bash
# Create new repo on GitHub: library_app_bookish_v2
git branch -M main
git remote add origin https://github.com/patrickrbarry/library_app_bookish_v2.git
git push -u origin main
```

### Step 5: Deploy on Netlify

1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Choose GitHub
4. Select `library_app_bookish_v2`
5. Click "Deploy site"

Netlify will auto-deploy on every push to main!

## 🧪 Testing Locally

### Option 1: Python HTTP Server

```bash
cd ~/library_app_bookish_v2
python3 -m http.server 8000
```

Then open: http://localhost:8000

### Option 2: Live Server (VS Code)

1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"

## 📥 Import Your Books

1. Open the app (locally or on Netlify)
2. Click the ↓ (Import) button
3. Select `IMPORT-CLASSIFIED.json`
4. Should import all 286 books!

## 🔑 API Configuration

The app uses your Vercel ISBN API:
- URL: `https://bookish-isbn-api.vercel.app/api/lookup`
- No configuration needed - it's hardcoded in `js/api.js`

## ✅ Testing Checklist

After deployment, test:

- [ ] Import IMPORT-CLASSIFIED.json (286 books)
- [ ] Search works (try "Build", "Tony Fadell")
- [ ] Filters work (Fiction/Nonfiction, Genre, Status, Formats)
- [ ] Sorting works (click column headers)
- [ ] Click book row opens detail sheet
- [ ] Amazon links work
- [ ] Copy Amazon link works
- [ ] Edit book works
- [ ] Delete book works (with confirmation)
- [ ] Add book manually works
- [ ] ISBN lookup works (try: 9780140328721)
- [ ] Export works (downloads JSON)
- [ ] PWA installable on iPhone
- [ ] localStorage persists across refreshes

## 🐛 Known Limitations

- Barcode scanning not yet implemented (buttons show "coming soon")
- OCR scanning not yet implemented (buttons show "coming soon")
- No cover image display in table (data stored, not shown)

## 📝 Data Format

Books are stored in localStorage as JSON:

```javascript
{
  "id": "book-1234567890-abc123",
  "title": "Build",
  "author": "Tony Fadell",
  "status": "unread",
  "genre": "Business",
  "fictionType": "Nonfiction",
  "difficulty": "Moderate",
  "formats": ["physical"],
  "notes": "",
  "isbn": "9780063046061",
  "publicationDate": "2022-05-03",
  "acquiredDate": "2024-12-01",
  "coverUrl": "",
  "addedAt": "2024-12-10T10:30:00.000Z"
}
```

## 🔧 Troubleshooting

**Books not persisting?**
- Check browser localStorage (Safari → Develop → Show Web Inspector → Storage)
- Make sure you're not in Private/Incognito mode

**Import failing?**
- Check JSON format (must be array of books)
- Look in browser console for errors

**ISBN lookup not working?**
- Check internet connection
- Verify API is running: https://bookish-isbn-api.vercel.app/api/lookup?isbn=9780140328721
- Check browser console for errors

## 📞 Support

Built for Patrick Barry  
Device: iPhone 13 mini  
Browser: Safari (PWA)

---

**Version:** 2.0  
**Date:** January 2026  
**Status:** Production Ready ✅
