<script lang="ts">
  interface Props {
    character: string
    status: "connecting" | "connected" | "disconnected"
    color: string
    volumeLevel: number
  }

  let { character, status, color, volumeLevel }: Props = $props()
</script>

<div
  style:background-color={`var(--color-${color}-900)`}
  style:border-color={`rgba(123, 241, 168, ${Math.min(255, (volumeLevel * 255) / 100)})`}
  class="relative flex size-10 items-center justify-center rounded-full text-lg text-white"
  class:border-2={status === "connected"}
  title={status}
>
  {character}
  <div
    class="absolute right-0 bottom-0 h-2 w-2 rounded-full"
    class:bg-green-500={status === "connected"}
    class:bg-red-500={status === "disconnected"}
    class:bg-yellow-500={status === "connecting"}
  ></div>
</div>
