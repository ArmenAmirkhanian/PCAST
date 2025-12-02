<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  export let tabs: { id: string; label: string }[] = [];
  export let active: string = '';        // supports optional bind:active
  export let useHash = true;             // set to false to keep URL clean

  const dispatch = createEventDispatcher<{ change: { id: string } }>();

  /** Ensure `active` is always a valid tab id when tabs change */
  $: {
    if (tabs?.length) {
      const hasActive = tabs.some(t => t.id === active);
      if (!hasActive) active = tabs[0].id;
    } else {
      active = '';
    }
  }

  function setActive(id: string) {
    if (id === active) return;
    active = id;
    if (useHash && typeof history !== 'undefined') {
      history.replaceState(null, '', `#${id}`);
    }
    dispatch('change', { id });
  }

  function readHashIntoActive() {
    if (!useHash || typeof location === 'undefined') return;
    const id = location.hash?.replace('#', '');
    if (id && tabs.some(t => t.id === id)) active = id;
  }

  function onKey(e: KeyboardEvent, idx: number) {
    const key = e.key;
    if (key === 'Home') {
      e.preventDefault();
      return setActive(tabs[0].id);
    }
    if (key === 'End') {
      e.preventDefault();
      return setActive(tabs[tabs.length - 1].id);
    }
    const dir = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (idx + dir + tabs.length) % tabs.length;
    const id = tabs[next].id;
    setActive(id);
    const btn = document.getElementById(`tab-${id}`) as HTMLButtonElement | null;
    btn?.focus();
  }

  function onHashChange() {
    readHashIntoActive();
  }

  onMount(() => {
    // Initialize from hash (if present and valid)
    readHashIntoActive();
    if (useHash && typeof window !== 'undefined') {
      window.addEventListener('hashchange', onHashChange);
    }
  });

  onDestroy(() => {
    if (useHash && typeof window !== 'undefined') {
      window.removeEventListener('hashchange', onHashChange);
    }
  });
</script>

<div class="w-full">
  <div role="tablist" aria-label="Sections" class="flex gap-2 border-b">
    {#each tabs as t, i}
      <button
        id={`tab-${t.id}`}
        type="button"
        role="tab"
        aria-selected={active === t.id}
        aria-controls={`panel-${t.id}`}
        tabindex={active === t.id ? 0 : -1}
        on:click={() => setActive(t.id)}
        on:keydown={(e) => onKey(e as KeyboardEvent, i)}
        class={`px-4 py-2 -mb-px border-b-2 ${active === t.id ? 'border-black font-semibold' : 'border-transparent text-gray-500'}`}
      >{t.label}</button>
    {/each}
  </div>

  <!-- Provide active to both default and named slots -->
  <slot {active} />
  <slot name="panels" {active} />
</div>

<style>
  /* Optional: add focus-visible outline for keyboard users */
  button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
</style>
