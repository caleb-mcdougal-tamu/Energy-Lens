# Energy Lens

An industrial energy assessment photo management app.

Energy Lens is a mobile-friendly web app for organizing energy assessment field photos by site, equipment type, and piece of equipment. You can tag each photo (Nameplate, Equipment, Screen, Logger, Data Collection, Measurement, Team), browse and retag photos in a full-screen viewer, and export an assessment as a PDF report or a ZIP of neatly named photos.

There is no backend or database. All data lives in each user's own **Google Drive**, so hosting is free. The app is a static site; Vercel's free tier works well.

## How data is stored

When a user signs in with Google, the app creates an `Energy Lens` folder in their My Drive:

```
My Drive/
└─ Energy Lens/
   └─ Acme Plant Audit/            ← an assessment (one folder per assessment)
      ├─ Data Collection/
      │   └─ Motors/  photo_….jpg
      ├─ Compressed Air/            ← equipment type
      │   ├─ photo_….jpg            ← type-level photo
      │   └─ Compressor 1/          ← equipment
      │       └─ photo_….jpg
      └─ Exports/                   ← every PDF report and ZIP you generate (timestamped)
```

- **Photos are ordinary Drive files.** Open, download, or share them from Drive like any other file.
- **Tags and other details** (photo tag, capture time, site location, sort order) are saved as hidden Drive file *properties*. They travel with the files and show up for everyone with access.
- **Photos from the phone or computer:** *Camera* takes a photo; *Library* picks images from the phone's photo library or the computer's files. Images are resized to JPEG before upload.
- **Photos already in Drive:** *Drive* opens an in-app browser for My Drive, Shared with me, and shared drives. The photos you pick are **copied** into the equipment folder and the originals stay where they were. You can also drop images straight into an assessment's folders in Drive; they appear in the app tagged `EQUIPMENT` until retagged.
- **Exports:** each *Generate PDF* or *Download ZIP* also saves a copy to the assessment's `Exports` folder, named with the date and time (for example `Acme_Plant_Audit_2026-10-21_1430.zip`), so earlier versions are kept. *Last report* and *Last archive* open the newest ones in Drive.
- **Deleting** an assessment, type, equipment item, or photo moves it to the owner's Drive trash, where it can be restored for 30 days.

### Working as a team

To collaborate on an assessment, share its folder in Google Drive (assessment ⋯ menu → **Open in Google Drive** → **Share**) and give teammates **Editor** access. The assessment then appears automatically on their Energy Lens home screen, and everyone sees and tags the same photos. Teammates need to sign in through the same Energy Lens deployment, or any deployment of this code.

Assessments created inside a **shared drive** work as well. Move the assessment folder into the shared drive and everyone with access to that drive will see it.

## Setup

You need a Google Cloud project with an OAuth client ID. It's free and takes about 10 minutes.

### 1. Create the Google OAuth client

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (for example "Energy Lens").
2. **Enable the Drive API:** *APIs & Services → Library →* search "Google Drive API" → **Enable**.
3. **Configure the OAuth consent screen** (*Google Auth Platform → Branding / Audience*):
   - **App name:** Energy Lens. Add a support email.
   - **Audience:**
     - **Internal** works if everyone who will use the app belongs to the same Google Workspace organization (for example a company or university domain) and your project is in that organization. Anyone in the org can sign in with no warnings.
     - **External** otherwise. While the app is in **Testing** status, add each user's Google account under **Test users** (up to 100). Testers see a "Google hasn't verified this app" screen the first time and click **Continue**.
   - **Data access → Add scope:** `https://www.googleapis.com/auth/drive` (listed as ".../auth/drive").
4. **Create the client ID:** *Clients → Create client → Application type: Web application.*
   - **Authorized JavaScript origins:**
     - `http://localhost:5173` (local development)
     - `https://<your-project>.vercel.app` (add once you know your Vercel URL, plus any custom domain)
   - Leave **Authorized redirect URIs** empty. The app uses Google's popup token flow.
5. Copy the **Client ID** (it looks like `1234-abc.apps.googleusercontent.com`). It isn't a secret: it ships to the browser, and Google only accepts it from the origins you listed.

> **Why full Drive access?** Team sharing requires it: only the full `drive` scope lets the app see folders a teammate shared with you, and lets you browse your existing Drive photos to import. Google classifies this scope as *restricted*. That's fine for Internal apps and for External apps in Testing. Making an External app public to any Google user requires Google's restricted-scope verification.

### 2. Run locally

Requires [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install
cp .env.example .env.local   # then set VITE_GOOGLE_CLIENT_ID in .env.local
npm run dev
```

Open http://localhost:5173 and sign in with Google.

Other scripts: `npm run build` (production build to `dist/`), `npm run preview` (serve the build), `npm run lint`.

### 3. Deploy to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com/new), **Import** the repository. Vercel detects Vite, and `vercel.json` sets the build, the `dist` output folder, and the SPA rewrites.
3. Under **Environment Variables**, add `VITE_GOOGLE_CLIENT_ID` with your client ID, then deploy.
4. Back in Google Cloud Console, add the deployed URL (for example `https://energy-lens.vercel.app`) to the OAuth client's **Authorized JavaScript origins**. It can take a few minutes to take effect.

Each person or group that deploys their own copy creates their own Google Cloud project and client ID. Nothing is shared between deployments except the code.

## Notes and limitations

- **Sessions:** Google access tokens last about an hour, and a static site can't refresh them silently. When one expires, the app shows a **Session expired → Continue** prompt, and anything in progress (such as an upload) resumes after you tap it.
- **Thumbnails:** grid thumbnails come from Drive's thumbnail service, which can take a few seconds to generate for new uploads. Until then the app downloads the full image.
- **HEIC photos imported from Drive:** browsers other than Safari can't render HEIC. The app shows Drive's JPEG preview instead, and PDF reports use that preview. Photos taken or uploaded through the app are always converted to JPEG.
- **Sharing permissions:** in a My Drive folder shared with you, Google lets you trash only the files you own. Ask the folder owner to remove other people's photos, or use a shared drive, where editors can trash any file.

## Project structure

```
src/
  api/db.js                 Data layer: assessments, types, equipment, photos ↔ Drive folders/files
  lib/google/auth.js        Google Identity Services sign-in and token handling
  lib/google/drive.js       Minimal Drive v3 REST client (list, upload, copy, update, download)
  lib/google/driveImages.js Thumbnail and full-image loading for private Drive files
  components/DrivePhotoPicker.jsx  In-app Drive browser for importing photos
  pages/                    Home, assessment, equipment type, and equipment screens
  lib/buildArchive.js       ZIP export
  lib/generateReport.js     PDF report (jsPDF)
```

Built with React, Vite, Tailwind CSS, shadcn/ui, and TanStack Query.

## License and citation

Released under the [MIT License](LICENSE). If you use Energy Lens in your work, please cite it using the metadata in [CITATION.cff](CITATION.cff) (GitHub's **Cite this repository** button generates APA and BibTeX from it).
