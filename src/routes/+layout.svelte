<script lang="ts">
  import "../app.css"

  let { children } = $props()
</script>

<svelte:head>
  <title>GGEZ</title>
</svelte:head>
<div class="container mx-auto px-4">
  <nav class="flex h-20 items-center gap-3">
    <a href="/">
      <img
        class="-ms-[14px]"
        alt="GGEZ Logo"
        height="61"
        src="/logo.png"
        width="150"
      />
    </a>
  </nav>
  {@render children()}
</div>
