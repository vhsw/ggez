<script lang="ts">
  import { pick } from "$lib/utils"
  import volumeProcUrl from "$lib/volume-processor?worker&url"
  import { Realtime, type InboundMessage, type RealtimeChannel } from "ably"
  import { onDestroy, onMount } from "svelte"
  import { fade } from "svelte/transition"
  import type { PageData } from "./$types"
  import Avatar from "./Avatar.svelte"

  const { data }: { data: PageData } = $props()
  const configuration = {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302"] },
      { urls: ["stun:stun2.l.google.com:19302"] },
      { urls: ["stun:stun4.l.google.com:19302"] },
    ],
  }

  let callStatus = $state<"connecting" | "connected" | "disconnected">("disconnected")
  let signalingStatus = $state<"connecting" | "connected" | "disconnected">("disconnected")
  let micMuted = $state(false)
  let micLevel = $state(0)

  interface Peer {
    connectionId: string
    name: string
    rtcStatus: "connecting" | "connected" | "disconnected"
    channel: RealtimeChannel
    pc: RTCPeerConnection | null
    volume: number
    micLevel: number
    remoteAudio?: HTMLAudioElement
    color: string
  }
  let peers = $state<Record<string, Peer>>({})
  const sortedPeers = $derived(Object.values(peers).sort((a, b) => a.name.localeCompare(b.name)))

  let localStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let realtime: Realtime | null = null
  let roomChannel: RealtimeChannel | null = null
  let selfChannel: RealtimeChannel | null = null
  let jumpIn: HTMLAudioElement
  let beepBad: HTMLAudioElement
  let beepGood: HTMLAudioElement

  onMount(async () => {
    signalingStatus = "connecting"
    realtime = new Realtime({ authUrl: "/auth", clientId: data.name, echoMessages: false })
    roomChannel = realtime.channels.get(data.id)
    const getRandomColor = () =>
      pick(["amber", "lime", "emerald", "cyan", "sky", "indigo", "violet", "pink"])

    await roomChannel.presence.subscribe(["present", "enter"], (msg) => {
      if (msg.connectionId === realtime!.connection.id) return
      if (!(msg.connectionId in peers)) {
        jumpIn.play()
      }
      peers[msg.connectionId] = {
        connectionId: msg.connectionId,
        name: msg.clientId,
        pc: null,
        volume: 1,
        micLevel: 0,
        channel: realtime!.channels.get(`${data.id}:${msg.connectionId}`),
        rtcStatus: "disconnected",
        color: getRandomColor(),
      }
    })
    await roomChannel.presence.subscribe("leave", (msg) => {
      delete peers[msg.connectionId]
    })
    await roomChannel.presence.enterClient(data.name)
    signalingStatus = "connected"
  })

  onDestroy(async () => {
    if (callStatus !== "disconnected") {
      leaveCall()
    }
    roomChannel?.unsubscribe()
    roomChannel?.detach()
  })

  const joinCall = async () => {
    callStatus = "connecting"
    if (!realtime) {
      callStatus = "disconnected"
      return
    }

    selfChannel = realtime.channels.get(`${data.id}:${realtime.connection.id}`)
    await selfChannel.subscribe("icecandidate", async (msg) => {
      console.debug("Received ice candidate", msg)
      const pc = getPeer(msg).pc
      if (!pc) {
        console.error("Received ice candidate for non-existent peer connection")
        return
      }
      pc.addIceCandidate(msg.data)
    })
    await selfChannel.subscribe("offer", async (msg) => {
      console.debug("Received offer", msg)
      const peer = getPeer(msg)
      if (peer.pc) {
        peer.pc.close()
      }
      peer.pc = createRTCPeerConnection(peer)
      peer.pc.setRemoteDescription(new RTCSessionDescription(msg.data))
      const answer = await peer.pc.createAnswer()
      peer.pc.setLocalDescription(answer)
      realtime?.channels.get(`${data.id}:${msg.connectionId}`).publish("answer", answer)
    })
    await selfChannel.subscribe("answer", async (msg) => {
      console.debug("Received answer", msg)
      const peer = getPeer(msg)
      if (peer.pc?.signalingState !== "stable") {
        peer.pc?.setRemoteDescription(new RTCSessionDescription(msg.data))
      }
    })
    audioContext = new AudioContext()
    await audioContext.audioWorklet.addModule(volumeProcUrl)
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      })
      micMuted = false
    } catch (error) {
      console.error("Error accessing media devices", error)
    }
    if (localStream) {
      const volumeNode = new AudioWorkletNode(audioContext, "volume-processor")
      volumeNode.port.onmessage = (event: MessageEvent<{ volume: number }>) => {
        micLevel = event.data.volume * 10
      }
      const micNode = audioContext.createMediaStreamSource(localStream)
      micNode.connect(volumeNode)
    }
    const getPeer = (msg: InboundMessage) => {
      if (!msg.connectionId || !(msg.connectionId in peers)) {
        throw new Error(`Invalid connectionId: ${msg.connectionId}`)
      }
      return peers[msg.connectionId]
    }

    Object.values(peers).forEach((p) => {
      initiateConnection(p)
    })
    callStatus = "connected"
  }

  const initiateConnection = async (peer: Peer) => {
    console.debug(`connecting to peer ${peer.name}`)
    peer.pc = createRTCPeerConnection(peer)
    peer.rtcStatus = "connecting"
    const description = await peer.pc?.createOffer()
    await peer.pc?.setLocalDescription(description)
    peer.channel?.publish("offer", description)
  }

  const createRTCPeerConnection = (peer: Peer) => {
    const { channel, remoteAudio } = peer
    const pc = new RTCPeerConnection(configuration)
    pc.addEventListener("icecandidate", async (event) => {
      if (event.candidate) {
        channel?.publish("icecandidate", event.candidate.toJSON())
      }
    })
    pc.addEventListener("iceconnectionstatechange", async () => {
      console.debug("iceconnectionstatechange", pc.iceConnectionState)
    })
    pc.addEventListener("track", (event) => {
      const stream = event.streams[0]
      if (audioContext) {
        const volumeNode = new AudioWorkletNode(audioContext, "volume-processor")
        volumeNode.port.onmessage = (event: MessageEvent<{ volume: number }>) => {
          peer.micLevel = event.data.volume * 10
        }
        const micNode = audioContext.createMediaStreamSource(stream)
        micNode.connect(volumeNode)
      }
      if (remoteAudio) {
        remoteAudio.srcObject = stream
      }
    })
    pc.addEventListener("connectionstatechange", () => {
      console.debug("connectionstatechange", pc.connectionState)
      switch (pc.connectionState) {
        case "connected":
          console.debug("Connected to remote peer")
          beepGood?.play()
          peer.rtcStatus = "connected"
          break
        case "disconnected":
          console.debug("Disconnected from remote peer")
          beepBad?.play()
          peer.rtcStatus = "disconnected"
          break
      }
    })
    localStream?.getTracks().forEach((track) => {
      if (!pc || !localStream) return
      pc.addTrack(track, localStream)
    })
    return pc
  }

  const leaveCall = async () => {
    await audioContext?.close()
    Object.values(peers).forEach((p) => disconnectPeer(p))
    audioContext = null
    localStream?.getTracks().forEach((t) => t.stop())
    localStream = null
    selfChannel?.unsubscribe()
    selfChannel?.detach()
    selfChannel = null
    micLevel = 0
    callStatus = "disconnected"
  }

  const disconnectPeer = (peer: Peer) => {
    console.debug(`disconnecting peer ${peer.name}`)
    peer.pc?.close()
    peer.pc = null
    if (peer.remoteAudio) peer.remoteAudio.srcObject = null
    peer.rtcStatus = "disconnected"
  }

  const mute = async () => {
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = false
    })
    micMuted = true
  }

  const unmute = async () => {
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = true
    })
    micMuted = false
  }
</script>

<svelte:head>
  <title>{data.id} - GGEZ</title>
</svelte:head>

<h1 class="relative mb-5 text-2xl font-bold">
  <code
    class="relative"
    aria-describedby="id-helper"
    title={signalingStatus}
  >
    {data.id}
  </code>
  <div
    id="id-helper"
    class="text-sm font-normal text-gray-400"
    role="alert"
  >
    Share this room ID with your friends so they can join
  </div>
</h1>
<div class="mb-5">
  <div class="mb-3">Online peers:</div>
  <div class="grid max-w-md grid-cols-[2.5rem_auto_6rem] gap-4">
    <Avatar
      character={data.name[0]}
      color="purple"
      status={signalingStatus}
      volumeLevel={micLevel}
    />
    <div>
      <div>
        {data.name}
      </div>
      <div class="text-sm leading-4 font-normal text-gray-400">(You)</div>
    </div>
    {#if callStatus === "connected"}
      {#if micMuted}
        <button
          class="hover:text-primary-700 inline-flex items-center justify-center rounded-md border border-gray-600 bg-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-600 hover:bg-gray-700 hover:text-white"
          onclick={unmute}
          type="button"
        >
          Unmute
        </button>
      {:else}
        <button
          class="hover:text-primary-700 inline-flex items-center justify-center rounded-md border border-gray-600 bg-transparent px-4 py-2 text-sm text-gray-400 hover:border-gray-600 hover:bg-gray-700 hover:text-white"
          onclick={mute}
          type="button"
        >
          Mute
        </button>
      {/if}
    {:else}
      <div></div>
    {/if}
    {#each sortedPeers as peer (peer.connectionId)}
      <div
        class="col-span-3 grid grid-cols-subgrid"
        transition:fade
      >
        <Avatar
          character={peer.name[0]}
          color={peer.color}
          status={peer.rtcStatus}
          volumeLevel={peer.micLevel}
        />
        <div class="truncate">
          {peer.name}
        </div>
        <div>
          <input
            id="{peer.connectionId}-volume"
            class="w-20"
            max="1"
            min="0"
            step="0.01"
            title="volume"
            type="range"
            bind:value={peer.volume}
          />
          <audio
            bind:this={peer.remoteAudio}
            autoplay
            bind:volume={peer.volume}
          ></audio>
        </div>
      </div>
    {/each}
  </div>
</div>

<div class="mb-5">
  {#if callStatus === "disconnected"}
    <button
      class="rounded-md bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 active:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={signalingStatus !== "connected"}
      onclick={joinCall}
      type="button"
    >
      Join call
    </button>
  {:else if callStatus === "connected"}
    <button
      class="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 active:bg-red-700"
      onclick={leaveCall}
      type="button"
    >
      Leave call
    </button>
  {:else if callStatus === "connecting"}
    <button
      class="cursor-wait rounded-md bg-gray-600 px-4 py-2 text-white"
      disabled
      type="button"
    >
      Connecting...
    </button>
  {/if}
</div>
<audio
  bind:this={jumpIn}
  src="/jumping.ogg"
  volume={1}
></audio>
<audio
  bind:this={beepGood}
  src="/beep-good.ogg"
  volume={0.2}
></audio>
<audio
  bind:this={beepBad}
  src="/beep-bad.ogg"
  volume={1}
></audio>
