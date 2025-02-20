<script lang="ts">
  interface Props {
    name: string
    status: "connecting" | "connected" | "disconnected"
    color: string
  }

  let { name, status, color }: Props = $props()
</script>

<div class="flex items-center space-x-2">
  <div
    style:background-color={`var(--color-${color}-900)`}
    class="relative flex size-8 h-8 w-8 items-center justify-center rounded-full text-lg text-white"
  >
    {name[0]}
    <div
      class="absolute right-0 bottom-0 h-2 w-2 rounded-full"
      class:bg-green-500={status === "connected"}
      class:bg-red-500={status === "disconnected"}
      class:bg-yellow-500={status === "connecting"}
    ></div>
  </div>
  <div>{name}</div>
</div>
