<script lang="ts">
  import { onDestroy } from 'svelte';
  import { projectInfo, updateProjectInfo } from '$lib/stores/form';
  import type { PlacesIndex } from '$lib/types';

  export let placesIndex: PlacesIndex = {};

  let state = '';
  let city = '';

  let query = '';
  let typed = query;
  let suggestions: string[] = [];
  let dropdownSuggestions: string[] = [];
  let error: string | null = null;
  let debounceId: ReturnType<typeof setTimeout>;
  let pool: string[] = [];
  let inputEl: HTMLInputElement | null = null;
  let inputId = `city-${Math.random().toString(36).slice(2,9)}`;

  const unsubscribe = projectInfo.subscribe((info) => {
    const stateChanged = info.state !== state;
    const cityChanged = info.city !== city;

    state = info.state;
    city = info.city;

    if (stateChanged) {
      typed = info.city || '';
      query = info.city || '';
      suggestions = [];
      dropdownSuggestions = [];
      error = null;
      return;
    }

    if (cityChanged) {
      typed = info.city || '';
      query = info.city || '';
      suggestions = [];
      dropdownSuggestions = [];
      error = null;
    }
  });

  onDestroy(unsubscribe);

  $: state, pool = (placesIndex[state] || []).map((p) => p.city).slice().sort();
  $: {
    pool;
    if (typed) updateSuggestions(typed);
  }

  function updateSuggestions(text: string) {
    clearTimeout(debounceId);
    debounceId = setTimeout(() => {
      if (!state || text.trim().length < 3 || pool.length === 0) {
        query = text;
        suggestions = [];
        dropdownSuggestions = [];
        return;
      }

      const q = text.toLowerCase();
      const matches = pool.filter(p => p.toLowerCase().startsWith(q)).slice(0, 12);
      suggestions = matches;
      dropdownSuggestions = matches.slice(1);

      const primary = matches[0];
      if (primary && inputEl && text && primary.toLowerCase().startsWith(text.toLowerCase())) {
        query = primary;
        requestAnimationFrame(() => {
          const start = text.length;
          inputEl?.setSelectionRange(start, primary.length);
        });
        return;
      }

      query = text;
    }, 100);
  }

  function selectCity(name: string) {
    typed = name;
    query = name;
    error = null;
    suggestions = [];
    dropdownSuggestions = [];
    city = name;
    updateProjectInfo({ city: name });
  }

  function handleInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    typed = value;
    error = null;
    updateSuggestions(value);
  }

  function validate() {
    const current = query.trim();
    if (!state || !current) return;

    const match = pool.find(p => p.toLowerCase() === current.toLowerCase());
    if (match) {
      city = match;
      typed = match;
      query = match;
      suggestions = [];
      dropdownSuggestions = [];
      error = null;
      updateProjectInfo({ city });
      return;
    }

    error = 'No match found.';
    query = '';
    typed = '';
    city = '';
    suggestions = [];
    dropdownSuggestions = [];
    updateProjectInfo({ city });
  }
</script>
<div class="flex flex-col gap-1 relative">
  <label for={inputId} class="font-medium">City</label>
  <input id={inputId} class="border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
         class:border-red-500={!!error}
         class:text-red-700={!!error}
         placeholder={state ? 'Start typing (min 3 letters)…' : 'Select a state first'}
         bind:value={query}
         bind:this={inputEl}
         on:input={handleInput}
         on:blur={validate}
         disabled={!state}
         autocomplete="off" />
  {#if dropdownSuggestions.length > 0}
    <div class="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-white shadow"
         role="listbox"
         aria-label="City suggestions">
      {#each dropdownSuggestions as c}
        <button type="button"
                role="option"
                class="block w-full text-left px-3 py-2 hover:bg-gray-100"
                on:mousedown={() => selectCity(c)}>
          {c}
        </button>
      {/each}
    </div>
  {/if}
  {#if error}
    <div class="text-sm text-red-600">{error}</div>
  {/if}
</div>
