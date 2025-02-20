<script lang="ts">
  import { pick } from "$lib/utils"
  import volumeProcUrl from "$lib/volume-processor?worker&url"
  import { Realtime, type InboundMessage, type RealtimeChannel } from "ably"
  import { onDestroy, onMount } from "svelte"
  import { fade } from "svelte/transition"
  import type { PageData } from "./$types"
  import MicLevel from "./MicLevel.svelte"
  import PeerEl from "./Peer.svelte"

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
  let micVolume = $state(0)

  interface Peer {
    connectionId: string
    name: string
    rtcStatus: "connecting" | "connected" | "disconnected"
    channel: RealtimeChannel
    pc: RTCPeerConnection | null
    volume: number
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
      peers[msg.connectionId] = {
        connectionId: msg.connectionId,
        name: msg.clientId,
        pc: null,
        volume: 1,
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
    console.log("joining call")
    callStatus = "connecting"
    if (!realtime) {
      callStatus = "disconnected"
      return
    }

    selfChannel = realtime.channels.get(`${data.id}:${realtime.connection.id}`)
    await selfChannel.subscribe("icecandidate", async (msg) => {
      getPeer(msg).pc?.addIceCandidate(msg.data)
    })
    await selfChannel.subscribe("offer", async (msg) => {
      console.log("Received offer", msg)
      const peer = getPeer(msg)
      if (peer.pc) {
        peer.pc.close()
      }
      peer.pc = createRTCPeerConnection(peer)
      peer.pc.setRemoteDescription(new RTCSessionDescription(msg.data))
      const answer = await peer.pc.createAnswer()
      peer.pc.setLocalDescription(answer)
      realtime!.channels.get(`${data.id}:${msg.connectionId}`).publish("answer", answer)
    })
    await selfChannel.subscribe("answer", async (msg) => {
      console.log("Received answer", msg)
      const peer = getPeer(msg)
      if (peer.pc?.signalingState !== "stable") {
        peer.pc?.setRemoteDescription(new RTCSessionDescription(msg.data))
      }
      peer.rtcStatus = "connected"
    })
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      })
      micMuted = false
      await connectMicLevel(localStream)
    } catch (error) {
      console.error("Error accessing media devices", error)
    }
    const getPeer = (msg: InboundMessage) => {
      if (!msg.connectionId || !(msg.connectionId in peers)) throw new Error("Invalid connectionId")
      return peers[msg.connectionId]
    }

    Object.values(peers).forEach((p) => {
      initiateConnection(p)
    })
    callStatus = "connected"
  }

  const initiateConnection = async (peer: Peer) => {
    console.log(`connecting to peer ${peer.name}`)
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
    pc.addEventListener("iceconnectionstatechange", async (event) => {
      console.log("iceconnectionstatechange", event)
    })
    pc.addEventListener("track", (event) => {
      if (remoteAudio) {
        remoteAudio.srcObject = event.streams[0]
      }
    })
    pc.addEventListener("connectionstatechange", (event) => {
      console.log("connectionstatechange", event)
      if (pc?.connectionState === "connected") {
        console.log("Connected to remote peer")
        beepGood?.play()
        peer.rtcStatus = "connected"
      } else if (pc?.connectionState === "disconnected") {
        console.log("Disconnected from remote peer")
        disconnectPeer(peer)
        beepBad?.play()
      }
    })
    localStream?.getTracks().forEach((track) => {
      if (!pc || !localStream) return
      console.log("Adding track to peer connection")
      pc.addTrack(track, localStream)
    })
    return pc
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
    Object.values(peers).forEach((p) => disconnectPeer(p))
    audioContext = null
    localStream?.getTracks().forEach((t) => t.stop())
    localStream = null
    selfChannel?.unsubscribe()
    selfChannel?.detach()
    selfChannel = null
    callStatus = "disconnected"
  }

  const disconnectPeer = (peer: Peer) => {
    console.log("disconnecting peer")
    peer.pc?.close()
    peer.pc = null
    if (peer.remoteAudio) peer.remoteAudio.srcObject = null
    peer.rtcStatus = "disconnected"
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
</script>

<svelte:head>
  <title>{data.id} - GGEZ</title>
</svelte:head>

<h1 class="relative mb-5 text-2xl font-bold">
  Room <code>{data.id}</code>
</h1>
<div class="mb-5">
  Peers:
  <div class="grid w-md grid-cols-2 gap-4 px-2 py-4">
    <PeerEl
      name={data.name + " (You)"}
      color="purple"
      status={callStatus}
    />

    {#if callStatus === "connected"}
      <div class="flex items-center space-x-2">
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
  </div>
  {#each sortedPeers as peer (peer.connectionId)}
    <div
      class="grid w-md grid-cols-2 gap-4 px-2 py-4"
      transition:fade
    >
      <PeerEl
        name={peer.name}
        color={peer.color}
        status={peer.rtcStatus}
      />
      <input
        id="{peer.connectionId}-volume"
        class="w-16"
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
