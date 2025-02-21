<script lang="ts">
  import "../app.css"
  import GitHubIcon from "./GithubIcon.svelte"

  let { children } = $props()
</script>

<svelte:head>
  <title>GGEZ</title>
  <meta
    name="description"
    content="GGEZ is a low-latency voice chat for gamers with direct peer-to-peer connections ensuring exceptional stability and privacy for your calls"
  />
  <meta
    name="keywords"
    content="GGEZ, Voice chat, WebRTC, gaming, peer-to-peer"
  />
</svelte:head>
<div class="container mx-auto min-h-screen min-w-80 px-4">
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
  <footer
    class="fixed bottom-0 flex w-full flex-wrap justify-start gap-4 bg-gray-900 p-2 text-gray-300"
  >
    <span>
      &copy; 2025 by
      <a
        class="transition hover:text-white"
        href="https://github.com/vhsw"
        target="_blank"
      >
        Alexey Dubrov
      </a>
    </span>
    <a
      class="justify-self-end transition hover:text-white"
      aria-label="This project on GitHub"
      href="https://github.com/vhsw/ggez"
      target="_blank"
    >
      <GitHubIcon />
    </a>
  </footer>
</div>
