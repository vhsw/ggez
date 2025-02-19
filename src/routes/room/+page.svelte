<script lang="ts">
  import volumeProcUrl from "$lib/volume-processor?worker&url"
  import { Realtime, type PresenceMessage, type RealtimeChannel } from "ably"
  import { onDestroy, onMount } from "svelte"
  import { slide } from "svelte/transition"
  import type { PageData } from "./$types"
  import MicLevel from "./MicLevel.svelte"

  const { data }: { data: PageData } = $props()

  let callStatus = $state<"connecting" | "connected" | "disconnected">("disconnected")
  let signalingStatus = $state<"connecting" | "connected" | "disconnected">("disconnected")
  let micMuted = $state(false)
  let micVolume = $state(0)
  let remoteAudio = $state<HTMLAudioElement>()
  let beepBad: HTMLAudioElement
  let beepGood: HTMLAudioElement
  let peers = $state<Record<string, PresenceMessage>>({})
  const sortedPeers = $derived(
    Object.values(peers).sort((a, b) => a.clientId.localeCompare(b.clientId)),
  )

  let pc: RTCPeerConnection | null = null
  let localStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let channel: RealtimeChannel | null = null

  const joinCall = async () => {
    console.log("joining call")
    callStatus = "connecting"
    micMuted = false

    pc = new RTCPeerConnection({
      iceServers: [
        { urls: ["stun:stun.l.google.com:19302"] },
        { urls: ["stun:stun2.l.google.com:19302"] },
        { urls: ["stun:stun4.l.google.com:19302"] },
      ],
    })
    pc.addEventListener("icecandidate", async (event) => {
      // console.log("icecandidate", event)
      if (event.candidate) {
        const newIceCandidate = new RTCIceCandidate(event.candidate)
        channel?.publish("candidate", newIceCandidate.toJSON())
      }
    })
    pc.addEventListener("iceconnectionstatechange", async (event) => {
      console.log("iceconnectionstatechange", event)
    })
    pc.addEventListener("track", (event) => {
      console.log("track", event)
      console.log({ remoteAudio })
      if (remoteAudio) {
        remoteAudio.srcObject = event.streams[0]
      }
    })
    pc.addEventListener("connectionstatechange", (event) => {
      console.log("connectionstatechange", event)
      if (pc?.connectionState === "connected") {
        console.log("Connected to remote peer")
        beepGood?.play()
        callStatus = "connected"
      } else if (pc?.connectionState === "disconnected") {
        console.log("Disconnected from remote peer")
        beepBad?.play()
        leaveCall()
      }
    })
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      })
      localStream.getTracks().forEach((track) => {
        if (!pc || !localStream) return
        pc.addTrack(track, localStream)
      })
      await connectMicLevel(localStream)
    } catch (error) {
      console.error("Error accessing media devices", error)
    }

    const description = await pc.createOffer()
    await pc.setLocalDescription(description)
    channel?.publish("offer", description)
  }

  async function connectMicLevel(stream: MediaStream) {
    audioContext = new AudioContext()
    await audioContext.audioWorklet.addModule(volumeProcUrl)
    const volumeNode = new AudioWorkletNode(audioContext, "volume-processor")
    volumeNode.port.onmessage = (event: MessageEvent<{ volume: number }>) => {
      micVolume = event.data.volume * 10
    }
    const micNode = audioContext.createMediaStreamSource(stream)
    micNode.connect(volumeNode)
  }

  const leaveCall = async () => {
    console.log("leaving call")
    await audioContext?.close()
    audioContext = null
    localStream?.getTracks().forEach((t) => t.stop())
    localStream = null
    pc?.close()
    pc = null
    callStatus = "disconnected"
  }

  const mute = async () => {
    console.log("muting")
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = false
    })
    micMuted = true
  }

  const unmute = async () => {
    console.log("unmuting")
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = true
    })
    micMuted = false
  }

  onMount(async () => {
    signalingStatus = "connecting"
    const realtime = new Realtime({ authUrl: "/auth", clientId: data.name, echoMessages: false })
    channel = realtime.channels.get(data.id)

    await channel.presence.subscribe("enter", (msg) => {
      console.log("enter", msg)
      peers[msg.connectionId] = msg
    })
    await channel.presence.subscribe("update", (msg) => {
      console.log("update", msg)
      peers[msg.connectionId] = msg
    })
    await channel.presence.subscribe("leave", (msg) => {
      console.log("leave", msg)
      delete peers[msg.connectionId]
    })
    await channel.presence.subscribe("present", (msg) => {
      console.log("present", msg)
      peers[msg.connectionId] = msg
    })
    await channel.subscribe("candidate", async (msg) => {
      console.log("Received candidate", msg)
      pc?.addIceCandidate(msg.data)
    })
    await channel.subscribe("offer", async (msg) => {
      console.log("Received offer", msg)
      if (!pc) return
      pc.setRemoteDescription(new RTCSessionDescription(msg.data))
      const answer = await pc?.createAnswer()
      channel?.publish("answer", answer)
      pc.setLocalDescription(answer)
    })
    await channel.subscribe("answer", async (msg) => {
      console.log("Received answer", msg)
      pc?.setRemoteDescription(new RTCSessionDescription(msg.data))
    })

    channel.presence.enterClient(data.name)
    signalingStatus = "connected"
  })

  onDestroy(async () => {
    if (callStatus !== "disconnected") {
      leaveCall()
    }
    await channel?.detach()
  })
</script>

<svelte:head>
  <title>{data.id} - GGEZ</title>
</svelte:head>

<h1 class="relative mb-5 text-2xl font-bold">
  Room <code>{data.id}</code>
</h1>
<div class="mb-5">
  Peers:
  {#each sortedPeers as peer (peer.id)}
    <div
      class=""
      title={peer.id}
      transition:slide
    >
      {peer.clientId}
    </div>
  {/each}
</div>
<div class="mb-5">
  <p>
    Signaling status: {signalingStatus}
  </p>
  <p>
    Call status: {callStatus}
  </p>
</div>
<div class="mb-5">
  {#if callStatus === "disconnected"}
    <button
      class="rounded-md bg-purple-500 px-4 py-2 text-white hover:bg-purple-600 active:bg-purple-600"
      onclick={joinCall}
      type="button"
    >
      Join call
    </button>
  {:else if callStatus === "connected"}
    <button
      class="rounded-md bg-red-500 px-4 py-2 text-white hover:bg-red-600 active:bg-red-600"
      onclick={leaveCall}
      type="button"
    >
      Leave call
    </button>
  {:else if callStatus === "connecting"}
    <button
      class="cursor-wait rounded-md bg-gray-500 px-4 py-2 text-white"
      disabled
      type="button"
    >
      Connecting...
    </button>
  {/if}
</div>

{#if callStatus === "connected"}
  <div class="mb-5 flex items-center gap-3">
    <MicLevel
      max={1}
      value={micVolume}
    />
    {#if micMuted}
      <button
        class="rounded-md bg-gray-500 px-4 py-2 text-white hover:bg-gray-600 active:bg-gray-600"
        onclick={unmute}
        type="button"
      >
        Unmute
      </button>
    {:else}
      <button
        class="rounded-md bg-gray-500 px-4 py-2 text-white"
        onclick={mute}
        type="button"
      >
        Mute
      </button>
    {/if}
  </div>
{/if}
<audio
  bind:this={remoteAudio}
  autoplay
  controls
></audio>

<audio
  bind:this={beepGood}
  src="/beep-good.ogg"
  volume="0.5"
></audio>
<audio
  bind:this={beepBad}
  src="/beep-bad.ogg"
  volume="0.5"
></audio>
