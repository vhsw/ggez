<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements"

  interface Props extends HTMLAttributes<HTMLDivElement> {
    character: string
    status: "connecting" | "connected" | "disconnected"
    volumeLevel: number
  }

  let { character, status, volumeLevel, class: klass, ...rest }: Props = $props()
</script>

<div
  style:border-color={`rgba(123, 241, 168, ${Math.min(255, (volumeLevel * 255) / 100)})`}
  class={[
    "relative flex size-10 items-center justify-center rounded-full border-2 text-lg text-white",
    klass,
  ]}
  title={status}
  {...rest}
>
  {character}
  <div
    class="absolute right-0 bottom-0 h-2 w-2 rounded-full"
    class:bg-green-600={status === "connected"}
    class:bg-red-600={status === "disconnected"}
    class:bg-yellow-600={status === "connecting"}
  ></div>
</div>
