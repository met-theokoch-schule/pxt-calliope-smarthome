import type { SimulatorControlMessage } from "./external/types"

export const SIMX_CHANNEL = "met-theokoch-schule/pxt-calliope-smarthome"
export const SIMX_PROTOCOL_VERSION = 1

export interface SmarthomeStatePayload {
    lamps: boolean[]
    lampColors: number[]
    wallLightColors: number[]
    shadesOpen: boolean
    airConditioningOn: boolean
}

export interface SmarthomeEnvelope {
    protocol: "smarthome"
    version: number
    type: "hello" | "state" | "input"
}

export interface SmarthomeHelloMessage extends SmarthomeEnvelope {
    type: "hello"
}

export interface SmarthomeStateMessage extends SmarthomeEnvelope {
    type: "state"
    payload: SmarthomeStatePayload
}

export interface SmarthomeInputMessage extends SmarthomeEnvelope {
    type: "input"
    payload: {
        source: "switch" | "presence"
        action: "press" | "release" | "shortPress" | "longPress" | "trigger"
        index?: number
    }
}

export type SmarthomeMessage = SmarthomeHelloMessage | SmarthomeStateMessage | SmarthomeInputMessage

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function decodeSmarthomeMessage(eventData: unknown): SmarthomeMessage | undefined {
    const message = eventData as SimulatorControlMessage
    if (!message || message.type !== "messagepacket" || message.channel !== SIMX_CHANNEL || !message.data) {
        return undefined
    }

    try {
        return JSON.parse(decoder.decode(message.data)) as SmarthomeMessage
    } catch {
        return undefined
    }
}

export function postSmarthomeMessage(message: SmarthomeMessage) {
    const packet: SimulatorControlMessage = {
        type: "messagepacket",
        broadcast: true,
        channel: SIMX_CHANNEL,
        data: encoder.encode(JSON.stringify(message)),
    }

    window.parent.postMessage(packet, "*")
}
