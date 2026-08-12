/**
 * Machine-generated build identity, to go alongside the hand-maintained
 * numbers in $lib/version.ts.
 *
 * BUILD_ID is set by `kit.version.name` in svelte.config.js to the short git
 * commit of the build (with a trailing `+` when the working tree was dirty).
 * It is the last link in the audit chain: the declared calculation version
 * says which methodology produced a report, and the build id says which exact
 * source tree did. Nothing here is maintained by hand.
 */

import { version } from '$app/environment';

/** Short git commit of this build, e.g. "8f9be6a1" or "8f9be6a1+" if dirty. */
export const BUILD_ID = version;

/** "build 8f9be6a1" — the form printed in report footers. */
export const BUILD_LABEL = `build ${BUILD_ID}`;
