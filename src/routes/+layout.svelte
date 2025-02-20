<script lang="ts">
  import "../app.css"

  let { children } = $props()
</script>

<svelte:head>
  <title>GGEZ</title>
</svelte:head>
<div class="container mx-auto min-w-80 px-4">
  <nav class="flex h-20 items-center gap-3">
    <a href="/">
      <img
        class="-ms-[14px] transition hover:brightness-125"
        alt="GGEZ Logo"
        height="61"
        src="/logo.png"
        width="150"
      />
    </a>
  </nav>
  {@render children()}
</div>
