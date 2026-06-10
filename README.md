# PCAST

## Pavement Cracking Analysis & Scheduling Tool

PCAST is a SvelteKit-based web application for analyzing environmental conditions and material behavior related to pavement cracking and construction timing.

This guide explains how to download and run the project locally, even if you have little or no programming experience.

---

## What You Need

Before running PCAST, install these programs:

1. **Visual Studio Code (VS Code)**
   https://code.visualstudio.com/

2. **Git**
   https://git-scm.com/downloads

3. **Node.js — LTS Version**
   https://nodejs.org/
   Choose the **LTS (Long Term Support)** version.

After installing Git and Node.js, restart your computer, especially on Windows.

---

## Step 1 — Verify Your Installation

Open **VS Code**.

Go to:

```text
Terminal → New Terminal
```

Run these commands:

```bash
git --version
node --version
npm --version
```

If all three commands show version numbers, you are ready to continue.

If one of them is not recognized:

* `git` not found → install Git and restart VS Code.
* `node` or `npm` not found → install Node.js LTS and restart VS Code.

---

## Step 2 — Download the Project

You can download the project using either VS Code or the terminal.

### Option A — Clone Inside VS Code

This is the recommended method for beginners.

1. Open **VS Code**.

2. Press:

   ```text
   Ctrl + Shift + P
   ```

   On Mac:

   ```text
   Cmd + Shift + P
   ```

3. Type:

   ```text
   Git: Clone
   ```

4. Paste this repository URL:

   ```text
   https://github.com/ArmenAmirkhanian/PCAST
   ```

5. Choose a folder, such as **Documents**.

6. When VS Code asks whether to open the cloned repository, click **Open**.

VS Code should now open the PCAST project folder.

### Option B — Clone Using the Terminal

Open **VS Code**, then open a new terminal:

```text
Terminal → New Terminal
```

Run:

```bash
git clone https://github.com/ArmenAmirkhanian/PCAST
cd PCAST
code .
```

---

## Step 3 — Install Project Dependencies

In VS Code, open a terminal:

```text
Terminal → New Terminal
```

Make sure you are inside the `PCAST` folder.

You should see a file named:

```text
package.json
```

Now run:

```bash
npm install
```

This installs the required project dependencies.

The first install may take a few minutes. A folder named `node_modules` will be created. That is normal.

---

## Step 4 — Run the Application

Start the development server:

```bash
npm run dev
```

You should see output similar to:

```text
Local:   http://localhost:5173/
```

Open that link in your browser.

PCAST should now be running locally.

---

## Stopping and Restarting the App

To stop the app, click inside the terminal and press:

```text
Ctrl + C
```

To restart the app later, run:

```bash
npm run dev
```

---

## Optional Development Commands

### Check the Project

```bash
npm run check
```

### Check Formatting and Linting

```bash
npm run lint
```

### Run Tests

```bash
npm run test
```

---

## Build for Production

To create a production build:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## Troubleshooting

### `npm is not recognized`

Node.js is not installed, or VS Code has not been restarted since Node.js was installed.

**Solution:**

1. Install Node.js LTS.
2. Restart VS Code.
3. Try again.

---

### `git is not recognized`

Git is not installed, or VS Code has not been restarted since Git was installed.

**Solution:**

1. Install Git.
2. Restart VS Code.
3. Try again.

---

### Port Already in Use

If the default development port is already being used, run:

```bash
npm run dev -- --port 5174
```

Then open the new local link shown in the terminal.

---

### I Am in the Wrong Folder

Check your current folder:

```bash
pwd
ls
```

You should see:

```text
package.json
```

If you do not see `package.json`, move into the project folder:

```bash
cd PCAST
```

Then try again.

---

### Reinstall Dependencies

If the project dependencies become corrupted or something is not working correctly, you can reinstall everything.

On Mac or Linux:

```bash
rm -rf node_modules package-lock.json
npm install
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

---

## Project Structure

```text
PCAST/
├── docs/             Project documentation
├── src/              Application source code
├── static/           Static assets
├── package.json      Project dependencies and scripts
├── svelte.config.js  Svelte configuration
├── vite.config.ts    Vite configuration
└── README.md         Project instructions
```

---

## Updating Dependencies

To update installed packages:

```bash
npm update
```

After updating, it is a good idea to run:

```bash
npm run check
npm run build
```

---

## License

This project is licensed under the GNU Affero General Public License v3.0 or later.

---

## Maintainer

**Dr. Armen Amirkhanian, P.E.**
Department of Civil, Construction, and Environmental Engineering
The University of Alabama
