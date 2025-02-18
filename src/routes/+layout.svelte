<script lang="ts">
  import "../app.css"
  let { children } = $props()
</script>

<svelte:head>
  <title>GGEZ</title>
</svelte:head>
<div class="container mx-auto px-4">
  <nav class="flex h-20 items-center gap-3">
    <a
      class="text-2xl font-bold text-gray-200 hover:text-white"
      href="/"
    >
      [GGEZ]
    </a>
  </nav>
  {@render children()}
</div>
