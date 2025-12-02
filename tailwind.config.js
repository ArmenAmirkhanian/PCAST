import { skeleton } from '@skeletonlabs/tw-plugin';
import typography from '@tailwindcss/typography';
import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './node_modules/@skeletonlabs/skeleton/**/*.{svelte,js,ts}'
  ],
  theme: { extend: {} },
  plugins: [
    typography,
    forms,
    containerQueries,
    skeleton({
      themes: { preset: ['skeleton', 'modern', 'hamlindigo', 'rocket'] }
    })
  ]
};