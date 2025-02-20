<script lang="ts">
  let id = $state("")
</script>

<form
  action="/room"
  method="get"
>
  <div class="mb-5">
    <label
      class="mb-2 block"
      for="id"
    >
      Room ID:
    </label>
    <input
      id="id"
      name="id"
      class="me-2 mb-1 rounded-md border border-gray-600 bg-gray-700 px-4 py-2 outline-none"
      aria-describedby="id-helper"
      required
      type="text"
      value={id}
    />
    <button
      class="hover:text-primary-700 rounded-md border border-gray-600 bg-transparent px-4 py-2 text-gray-400 hover:border-gray-600 hover:bg-gray-700 hover:text-white"
      onclick={() => {
        id = crypto.randomUUID()
      }}
      type="button"
    >
      Random
    </button>
    <div
      id="id-helper"
      class="text-sm text-gray-400"
      role="alert"
    >
      Enter a room ID or click "Random" to generate one.
    </div>
  </div>
  <div class="mb-5">
    <label
      class="mb-2 block"
      for="name"
    >
      Your name:
    </label>
    <input
      id="name"
      name="name"
      class="rounded-md border border-gray-600 bg-gray-700 px-4 py-2 outline-none"
      type="text"
    />
  </div>
  <div class="mb-5">
    <button
      class="rounded-md bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 active:bg-purple-700"
      type="submit"
    >
      Join room
    </button>
  </div>
</form>
