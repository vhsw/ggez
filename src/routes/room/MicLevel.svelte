<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements"
  interface Props extends HTMLAttributes<HTMLDivElement> {
    value: number
    max: number
  }

  let { value, max, class: klass, ...rest }: Props = $props()
</script>

<div
  class={["relative h-10 w-4 overflow-clip rounded dark:bg-gray-700", klass]}
  {...rest}
>
  <div
    style:height={Math.min(value / max, 1) * 100 + "%"}
    class="absolute bottom-0 w-full rounded bg-purple-600"
  ></div>
</div>
