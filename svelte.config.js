import { execSync } from 'node:child_process';
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Identify the exact source tree this build came from, for the version stamp
 * printed on reports. Surfaced to the app as `version` from `$app/environment`
 * and read through $lib/build-info.ts.
 *
 * Falls back to SvelteKit's own default (a timestamp) outside a git checkout —
 * a build without git history still gets a distinct id, it just cannot be
 * traced back to a commit.
 */
function buildId() {
	const git = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
	try {
		const sha = git('git rev-parse --short=8 HEAD');
		// A dirty tree is not the commit it claims to be; mark it so a report
		// generated from a work-in-progress build cannot be mistaken for a release.
		const dirty = git('git status --porcelain') ? '+' : '';
		return `${sha}${dirty}`;
	} catch {
		return Date.now().toString();
	}
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			out: 'build',
			precompress: true
		}),
		version: {
			name: buildId()
		}
	}
};

export default config;
