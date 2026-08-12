# PCAST — Complete Deployment Guide

This guide walks you through installing and running your own local copy of **PCAST** (Pavement Cracking Analysis & Scheduling Tool) from start to finish.

**No prior experience with GitHub, PowerShell, or the command line is assumed.** Every command is written out exactly as you should type it.

---

## Before You Start — What to Expect

| Item | Detail |
|---|---|
| Time required | ~20 minutes of setup + 1–4 hours of downloading (the climate database is very large) |
| Free disk space needed | **At least 25 GB** (the database alone is 17.2 GB) |
| Internet | Required for setup; the app runs offline afterward except for live weather forecasts |
| Operating system | Windows 10/11, macOS, or Linux |
| Cost | Free. No accounts required. |

You will do four things:

1. Install three free programs (Git, Node.js, VS Code)
2. Download the PCAST source code
3. Download the NOAA climate normals database (17.2 GB)
4. Tell PCAST where the database lives, then start it

---

## Step 1 — Install the Required Programs

Install all three. Click the link, download the installer, run it, and accept the default options unless noted.

### 1a. Node.js (required)

- Go to <https://nodejs.org/>
- Download the button labeled **LTS** (Long Term Support). Do *not* download "Current".
- Run the installer. Click Next through every screen and accept defaults.
- On Windows, if you see a checkbox called *"Automatically install the necessary tools..."*, **check it**. This installs compilers that PCAST's database library sometimes needs.

### 1b. Git (required)

- Go to <https://git-scm.com/downloads>
- Download and run the installer for your operating system.
- On Windows there are many screens of options. **Accept every default** and keep clicking Next.

### 1c. Visual Studio Code (recommended)

- Go to <https://code.visualstudio.com/>
- Download and install. This gives you a friendly place to type commands and view files.

### 1d. Restart your computer

This is not optional on Windows. The installers change system settings that only take effect after a restart.

---

## Step 2 — Open a Terminal

A "terminal" is a window where you type commands. Pick whichever method you prefer.

### Method A — Inside VS Code (recommended)

1. Open **Visual Studio Code**.
2. From the top menu, click **Terminal → New Terminal**.
3. A panel opens at the bottom of the window. That is your terminal.

### Method B — Windows PowerShell directly

1. Press the **Windows key**.
2. Type `powershell`.
3. Click **Windows PowerShell** in the results.

### Method C — macOS

1. Press **Cmd + Space**.
2. Type `terminal` and press **Enter**.

> **How to use a terminal:** you type one command, press **Enter**, and wait for it to finish before typing the next one. When you see a blinking cursor at a new line, it is ready for the next command.

---

## Step 3 — Verify Your Installation

Type each of these three commands, pressing **Enter** after each:

```
git --version
```

```
node --version
```

```
npm --version
```

You should see three version numbers, something like:

```
git version 2.47.0
v22.11.0
10.9.0
```

**If a command says "not recognized" or "command not found":**

| Problem | Fix |
|---|---|
| `git` not recognized | Git isn't installed, or you didn't restart. Reinstall Git, restart the computer, try again. |
| `node` or `npm` not recognized | Node.js isn't installed, or you didn't restart. Reinstall Node.js LTS, restart, try again. |

Do not continue until all three commands print a version number.

---

## Step 4 — Choose Where to Put PCAST

**Important:** do **not** put PCAST inside OneDrive, Dropbox, Google Drive, or iCloud folders. On Windows, `Documents` and `Desktop` are often synced to OneDrive without you realizing it. Cloud sync will try to upload the 17 GB database, which will fail slowly and painfully.

Create a plain folder at the root of your drive instead.

**Windows PowerShell:**

```
mkdir C:\PCAST
```

```
cd C:\PCAST
```

**macOS / Linux:**

```
mkdir ~/PCAST
```

```
cd ~/PCAST
```

`cd` means "change directory" — it moves you into that folder. Your terminal prompt should now show the new location.

---

## Step 5 — Download the PCAST Source Code

You are still inside `C:\PCAST` (or `~/PCAST`). Run:

```
git clone https://github.com/ArmenAmirkhanian/PCAST.git
```

This downloads the code into a subfolder named `PCAST`. Then move into it:

```
cd PCAST
```

Confirm you are in the right place — list the files:

**Windows:**

```
dir
```

**macOS / Linux:**

```
ls
```

You should see `package.json`, `src`, `docs`, `static`, and other entries. If you do not see `package.json`, you are in the wrong folder; run `cd PCAST` again.

<details>
<summary><b>Alternative: download without Git (click to expand)</b></summary>

If `git clone` fails, you can download a ZIP instead:

1. Go to <https://github.com/ArmenAmirkhanian/PCAST>
2. Click the green **Code** button near the top right.
3. Click **Download ZIP**.
4. Move the ZIP to `C:\PCAST`, right-click it, and choose **Extract All**.
5. You will end up with a folder like `C:\PCAST\PCAST-main`. Use that folder everywhere this guide says `PCAST`.

Note that with the ZIP method you cannot get updates with `git pull` later — you would have to download a fresh ZIP each time.

</details>

---

## Step 6 — Open the Project in VS Code

From inside the `PCAST` folder, run:

```
code .
```

(That is the word `code`, a space, then a period. The period means "this folder.")

VS Code opens with the whole project visible in the left sidebar. Open a terminal inside it with **Terminal → New Terminal** — it will already be pointed at the project folder. Use this terminal for the remaining steps.

---

## Step 7 — Install the Project's Dependencies

Make sure your terminal is inside the `PCAST` folder (the one containing `package.json`), then run:

```
npm install
```

This downloads roughly 400 supporting libraries into a new folder called `node_modules`. **This takes 2–10 minutes.** You will see a lot of scrolling text; that is normal.

**Warnings are fine. Errors are not.** If you see lines beginning with `npm warn`, ignore them. If the command stops with `npm error`, see the [Troubleshooting](#troubleshooting) section, particularly the entry on `better-sqlite3`.

When it finishes you will see a summary like `added 412 packages in 3m`.

---

## Step 8 — Download the NOAA Climate Normals Database

PCAST needs NOAA's 30-year hourly climate normals to estimate site temperature conditions. This database is **17.2 GB** and is hosted separately on Hugging Face:

<https://huggingface.co/datasets/Armencrete/NOAA_30YR_ClimateNormals_HRLY>

The file is named **`normals_full.db`**.

First, make a folder to hold it (the terminal command below assumes you are still in `C:\PCAST\PCAST`):

**Windows:**

```
mkdir C:\PCAST\data
```

**macOS / Linux:**

```
mkdir ~/PCAST/data
```

Now choose **one** of the three download methods below.

### Method A — Browser (simplest, but no resume)

1. Open this link in your browser:
   <https://huggingface.co/datasets/Armencrete/NOAA_30YR_ClimateNormals_HRLY/resolve/main/normals_full.db?download=true>
2. The download starts immediately. Depending on your connection this takes 30 minutes to several hours.
3. When done, move `normals_full.db` from your Downloads folder into `C:\PCAST\data` (or `~/PCAST/data`).

**Risk:** if the download is interrupted, most browsers make you start over. On a slow or unreliable connection, use Method B or C.

### Method B — `curl` in the terminal (resumable)

`curl` is built into Windows 10/11, macOS, and Linux. The `-C -` flag means "resume where you left off if interrupted."

**Windows PowerShell:**

```
curl.exe -L -C - -o C:\PCAST\data\normals_full.db "https://huggingface.co/datasets/Armencrete/NOAA_30YR_ClimateNormals_HRLY/resolve/main/normals_full.db?download=true"
```

**macOS / Linux:**

```
curl -L -C - -o ~/PCAST/data/normals_full.db "https://huggingface.co/datasets/Armencrete/NOAA_30YR_ClimateNormals_HRLY/resolve/main/normals_full.db?download=true"
```

> On Windows you must type `curl.exe`, not just `curl`. In PowerShell, plain `curl` is an alias for a different, older command that will not work here.

If the download stops, re-run the exact same command and it will pick up where it left off.

### Method C — Hugging Face CLI (fastest, requires Python)

This uses Hugging Face's accelerated transfer and handles retries automatically.

```
pip install -U "huggingface_hub[cli]"
```

**Windows:**

```
hf download Armencrete/NOAA_30YR_ClimateNormals_HRLY normals_full.db --repo-type dataset --local-dir C:\PCAST\data
```

**macOS / Linux:**

```
hf download Armencrete/NOAA_30YR_ClimateNormals_HRLY normals_full.db --repo-type dataset --local-dir ~/PCAST/data
```

### Verify the download

Check that the file size is about **17.2 GB** (roughly 17,200,000,000 bytes). A much smaller file means the download was truncated.

**Windows:**

```
dir C:\PCAST\data
```

**macOS / Linux:**

```
ls -lh ~/PCAST/data
```

---

## Step 9 — Tell PCAST Where the Database Is

PCAST reads the database location from an environment variable named `DB_PATH`, stored in a file named `.env` in the project folder.

1. In VS Code's left sidebar, make sure the `PCAST` project folder is selected.
2. Click the **New File** icon (a page with a `+`), or press **Ctrl + N**.
3. Name the file exactly:

```
.env
```

   Yes, it starts with a period and has no name before the dot. That is correct.

4. Put the file in the top level of the `PCAST` folder — the same level as `package.json`, not inside `src`.
5. Type this single line into the file:

**Windows:**

```
DB_PATH=C:/PCAST/data/normals_full.db
```

**macOS / Linux:**

```
DB_PATH=/Users/YOURNAME/PCAST/data/normals_full.db
```

6. Save with **Ctrl + S** (**Cmd + S** on Mac).

### Rules for this file

- **Use forward slashes `/` even on Windows.** Backslashes are interpreted as escape characters and will break the path.
- No quotation marks around the path.
- No spaces around the `=` sign.
- Replace `YOURNAME` on macOS with your actual account name (run `echo $HOME` to see it).

### Optional second line

NOAA's live forecast API asks that applications identify themselves with a contact address. Add a second line if you plan to use the live forecast feature:

```
NWS_USER_AGENT=PCAST-local (your.email@example.edu)
```

The `.env` file is already listed in `.gitignore`, so your local paths will never be uploaded to GitHub.

---

## Step 10 — Run PCAST

In the terminal, inside the `PCAST` folder:

```
npm run dev
```

After a few seconds you will see something like:

```
Opened SQLite at: C:/PCAST/data/normals_full.db

  VITE v8.0.16  ready in 843 ms

  ➜  Local:   http://localhost:5173/
```

The line **`Opened SQLite at:`** is your confirmation that the database was found. If you instead see `Database not found at ...`, go back to Step 9 and fix the path.

Now open <http://localhost:5173/> in your browser — or hold **Ctrl** and click the link in the terminal.

**PCAST is now running on your machine.**

### Stopping and restarting

| Action | How |
|---|---|
| Stop the app | Click inside the terminal and press **Ctrl + C** |
| Start it again | `npm run dev` from inside the `PCAST` folder |

The app only runs while that terminal window is open. Closing the terminal shuts down PCAST.

---

## Step 11 (Optional) — Build a Production Version

The development server in Step 10 is fine for personal use. A production build is faster and is what you would use on a shared server.

```
npm run build
```

This creates a `build` folder. To run it, you must supply `DB_PATH` as an environment variable — the production server does **not** read the `.env` file automatically.

**Windows PowerShell:**

```
$env:DB_PATH="C:/PCAST/data/normals_full.db"
```

```
node build/index.js
```

**macOS / Linux:**

```
DB_PATH=~/PCAST/data/normals_full.db node build/index.js
```

The production server listens on **<http://localhost:3000>** by default. To change the port:

**Windows PowerShell:**

```
$env:PORT="8080"
```

```
node build/index.js
```

**macOS / Linux:**

```
DB_PATH=~/PCAST/data/normals_full.db PORT=8080 node build/index.js
```

> Environment variables set with `$env:` last only for that PowerShell window. Close it and you must set them again.

---

## Keeping Your Copy Up to Date

From inside the `PCAST` folder:

```
git pull
```

```
npm install
```

```
npm run dev
```

`git pull` fetches the latest code. `npm install` picks up any new dependencies. You do **not** need to re-download the database — it changes rarely, and only when NOAA publishes new normals.

---

## Troubleshooting

### `npm` or `node` is not recognized

Node.js is not installed, or you have not restarted since installing it. Install Node.js LTS from <https://nodejs.org/>, restart your computer, and reopen the terminal.

### `git` is not recognized

Same cause. Install Git from <https://git-scm.com/downloads>, restart, reopen the terminal.

### PowerShell: "running scripts is disabled on this system"

Windows blocks scripts by default and this can stop `npm`. Fix it for your user account only:

```
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Type `Y` and press **Enter** when prompted, then close and reopen PowerShell.

### `npm install` fails on `better-sqlite3`

PCAST reads the database with `better-sqlite3`, which contains compiled code. Normally npm downloads a prebuilt copy, but if none matches your system it will try to compile from source and may fail.

**Fix 1 — force a rebuild:**

```
npm rebuild better-sqlite3 --build-from-source
```

**Fix 2 — install build tools (Windows):**

```
npm install --global windows-build-tools
```

Or install the "Desktop development with C++" workload from Visual Studio Build Tools: <https://visualstudio.microsoft.com/visual-cpp-build-tools/>

**Fix 3 — use Node.js LTS.** Prebuilt binaries exist for LTS releases, not always for the newest "Current" release. Check with `node --version`; if it's an odd-numbered major version (23, 25, ...), reinstall the LTS version.

### `NODE_MODULE_VERSION` mismatch error

You upgraded Node.js after running `npm install`. Rebuild:

```
npm rebuild better-sqlite3
```

### "Database not found at normals_full.db. Running without DB."

PCAST started but cannot see the climate database. Check, in order:

1. Is the file actually at the path you specified? Run `dir C:\PCAST\data` and confirm `normals_full.db` is listed.
2. Is `.env` in the top level of the `PCAST` folder, alongside `package.json`?
3. Did you use forward slashes in the path?
4. Is the filename exactly `normals_full.db`? Windows may have saved it as `normals_full.db.download` or appended `(1)` if you downloaded it twice.
5. Did you restart the dev server after creating `.env`? Press **Ctrl + C** and run `npm run dev` again.

### The app loads but station lookups return nothing

The database file is probably truncated from an interrupted download. Confirm the size is ~17.2 GB and re-download if it is short. Method B or C in Step 8 will resume rather than restart.

### Port already in use

Something else is on port 5173. Use a different one:

```
npm run dev -- --port 5174
```

Then open the new address shown in the terminal.

### "I don't know what folder I'm in"

**Windows:**

```
pwd
```

```
dir
```

**macOS / Linux:**

```
pwd
```

```
ls
```

If you do not see `package.json` in the listing, you are in the wrong folder. Move into the project:

```
cd C:\PCAST\PCAST
```

### Dependencies are broken — start clean

**Windows PowerShell:**

```
Remove-Item -Recurse -Force node_modules
```

```
Remove-Item -Force package-lock.json
```

```
npm install
```

**macOS / Linux:**

```
rm -rf node_modules package-lock.json
```

```
npm install
```

### Antivirus is slowing everything down

Some antivirus products scan every file npm writes, turning a 3-minute install into 30. Adding `C:\PCAST` to your antivirus exclusion list solves this. Do this only if you are comfortable with the tradeoff.

---

## Quick Reference

All commands assume your terminal is inside the `PCAST` project folder.

| Task | Command |
|---|---|
| Install dependencies | `npm install` |
| Start the app | `npm run dev` |
| Stop the app | **Ctrl + C** |
| Start on a different port | `npm run dev -- --port 5174` |
| Type-check the project | `npm run check` |
| Check formatting and linting | `npm run lint` |
| Run tests | `npm run test` |
| Build for production | `npm run build` |
| Preview the production build | `npm run preview` |
| Get the latest code | `git pull` |

| Item | Value |
|---|---|
| Source code | <https://github.com/ArmenAmirkhanian/PCAST> |
| Climate database | <https://huggingface.co/datasets/Armencrete/NOAA_30YR_ClimateNormals_HRLY> |
| Database filename | `normals_full.db` (17.2 GB) |
| Database config variable | `DB_PATH`, set in `.env` |
| Dev server address | <http://localhost:5173> |
| Production server address | <http://localhost:3000> |

---

## Licensing and Attribution

PCAST is licensed under the **GNU Affero General Public License v3.0 or later**. The NOAA 30-year hourly climate normals dataset is released under **CC0 1.0** (public domain).

**Maintainer:** Dr. Armen Amirkhanian, P.E. — Department of Civil, Construction, and Environmental Engineering, The University of Alabama

If you hit a problem this guide does not cover, open an issue at <https://github.com/ArmenAmirkhanian/PCAST/issues>.
