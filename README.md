# PCAST  
## Pavement Cracking Analysis & Scheduling Tool

PCAST is a SvelteKit-based web application for analyzing environmental conditions and material behavior related to pavement cracking and construction timing.

This guide explains **exactly how to download and run the project locally**, even if you have little or no programming experience.

---

# What You Need (Install Once)

Before running PCAST, install these three programs:

1. **Visual Studio Code (VS Code)**  
   https://code.visualstudio.com/

2. **Git**  
   https://git-scm.com/downloads

3. **Node.js (LTS Version)**  
   https://nodejs.org/  
   Choose the **LTS (Long Term Support)** version.

After installing Node.js and Git, restart your computer (especially on Windows).

---

# Step 1 — Verify Installation

Open **VS Code**

Go to:  
**Terminal → New Terminal**

Run:

```bash
git --version
node --version
npm --version
````

If you see version numbers for all three, you're ready to continue.

If not:

Git not found → install Git

# Step 2 — Download (Clone) the Project

## Option A (Recommended — inside VS Code)

Open VS Code

Press Ctrl + Shift + P (or Cmd + Shift + P on Mac)

Type: Git: Clone

Paste this repository URL:

https://github.com/ArmenAmirkhanian/PCAST


Choose a folder (Documents is fine)

Click Open when prompted

VS Code will now open the PCAST project.

## Option B (Using Terminal)

Open VS Code → Terminal → New Terminal

Run:
````bash
git clone https://github.com/ArmenAmirkhanian/PCAST
cd PCAST
code .
````

# Step 3 — Install Project Dependencies

In VS Code:

Open Terminal → New Terminal

Make sure you are inside the PCAST folder.
You should see a file named package.json in the file list.

Now run:
````bash
npm install
````

This installs all required project dependencies.

This may take 1–5 minutes the first time.

A folder called node_modules will be created. That is normal.

# Step 4 — Run the Application

Start the development server:
````bash
npm run dev
````

You should see output similar to:
````bash
Local:   http://localhost:5173/
````

Open that link in your browser.

PCAST should now be running locally.

## How to Stop the App

In the terminal window, press:

Ctrl + C


To restart it later:
````bash
npm run dev
````
 
## Build for Production (Optional)

To create a production build:
````bash
npm run build
````

To preview the production build locally:
````bash
npm run preview
````

# Troubleshooting
## ❌ "npm is not recognized"

Node.js is not installed or VS Code needs to be restarted.

Solution:

Install Node.js (LTS)

Restart VS Code

## ❌ "git is not recognized"

Git is not installed.

Solution:

Install Git

Restart VS Code

## ❌ Port Already in Use

Try:
````bash
npm run dev -- --port 5174
````

Then open the new port shown in the terminal.

## ❌ I'm in the Wrong Folder

Check your location:
````bash
pwd
ls
````

If you do not see package.json, run:
````bash
cd PCAST
````
# Project Structure (High-Level)
```
PCAST/
├── src/           → Application source code
├── static/        → Static assets
├── package.json   → Project dependencies & scripts
├── svelte.config.js
├── vite.config.js
└── README.md
```

# Updating Dependencies

To update installed packages:
````bash
npm update
````

To completely reinstall everything:
````bash
rm -rf node_modules package-lock.json
npm install
````

(Windows users may need to delete the folders manually.)

# Maintainer

Dr. Armen Amirkhanian, P.E.

Department of Civil, Construction, and Environmental Engineering

The University of Alabama
