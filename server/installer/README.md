# NVAPlayerPC Windows Installer

## Prerequisites (builder machine only)
- Node.js (to build server EXE)
- Inno Setup 6

## Build steps
From `server` directory:

```powershell
npm install
npm run build
npm run build:installer
```

## Output
- EXE server: `server\NVAPlayerPC.exe`
- Installer: `server\installer\output\NVAPlayerPC-Setup.exe`

## Branding
- Installer icon is auto-generated from:
  - `server\public\nvlogo.png`
- Generated icon path:
  - `server\installer\assets\nvlogo.ico`

## Notes
- Installer includes `NVAPlayerPC.exe`.
- If present, it also includes Android APK from:
  - `android\app\build\outputs\apk\release\NVAPlayerPC.apk`
- Customer machine does **not** need Node.js.
