import { useEffect, useRef, useState } from "react"
import "./App.css"

import houseBaseImage from "./assets/smarthome/smarthome.png"
import climateImage from "./assets/smarthome/smarthome_klima.png"
import outsideLightImage from "./assets/smarthome/smarthome_a.png"
import outsideLightMaskImage from "./assets/smarthome/smarthome_a_color.png"
import ceilingLight1Image from "./assets/smarthome/smarthome_d1.png"
import ceilingLight1MaskImage from "./assets/smarthome/smarthome_d1_color.png"
import ceilingLight2Image from "./assets/smarthome/smarthome_d2.png"
import ceilingLight2OpenImage from "./assets/smarthome/smarthome_d2_offen.png"
import ceilingLight2MaskImage from "./assets/smarthome/smarthome_d2_color.png"
import shutterImage from "./assets/smarthome/smarthome_nur_rolladen.png"
import wallLight1Image from "./assets/smarthome/smarthome_w1.png"
import wallLight1MaskImage from "./assets/smarthome/smarthome_w1_color.png"
import wallLight2Image from "./assets/smarthome/smarthome_w2.png"
import wallLight2MaskImage from "./assets/smarthome/smarthome_w2_color.png"
import wallLight3Image from "./assets/smarthome/smarthome_w3.png"
import wallLight3MaskImage from "./assets/smarthome/smarthome_w3_color.png"
import wallLight4Image from "./assets/smarthome/smarthome_w4.png"
import wallLight4MaskImage from "./assets/smarthome/smarthome_w4_color.png"
import wallLight5Image from "./assets/smarthome/smarthome_w5.png"
import wallLight5MaskImage from "./assets/smarthome/smarthome_w5_color.png"
import wallLight6Image from "./assets/smarthome/smarthome_w6.png"
import wallLight6MaskImage from "./assets/smarthome/smarthome_w6_color.png"
import wallLight7Image from "./assets/smarthome/smarthome_w7.png"
import wallLight7MaskImage from "./assets/smarthome/smarthome_w7_color.png"
import wallLight8Image from "./assets/smarthome/smarthome_w8.png"
import wallLight8MaskImage from "./assets/smarthome/smarthome_w8_color.png"
import {
    decodeSmarthomeMessage,
    postSmarthomeMessage,
    SIMX_PROTOCOL_VERSION,
    type SmarthomeStatePayload,
} from "./protocol"

type OverlayId = "d1" | "d2" | "a" | "w1" | "w2" | "w3" | "w4" | "w5" | "w6" | "w7" | "w8" | "klima"

interface OverlayConfig {
    id: OverlayId
    src: string
    maskSrc?: string
    color: string
}

interface OverlayEntry {
    id: OverlayId
    image: HTMLImageElement
    defaultImage: HTMLImageElement
    alternateImage: HTMLImageElement | null
    maskImage: HTMLImageElement | null
    tintedCanvas: HTMLCanvasElement | null
    maskedCanvas: HTMLCanvasElement | null
    tintKey: string
    maskKey: string
    state: {
        active: boolean
        color: string
    }
}

interface RenderStyle {
    color: string
    lightAlpha: number
    maskAlpha: number
}

const MASK_OVERLAY_ALPHA = 0.85
const WALL_LIGHT_OVERLAY_ALPHA = 0.6
const SHUTTER_ANIMATION_DURATION_MS = 640
const CEILING_LIGHT_2_CLOSED_MASK_DELAY_MS = 350

const initialState: SmarthomeStatePayload = {
    lamps: [false, false, false, false],
    lampColors: [0x000000, 0x000000, 0x000000],
    wallLightColors: [0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000],
    shadesOpen: true,
    airConditioningOn: false,
}

function normalizeState(payload: Partial<SmarthomeStatePayload>, previousState?: SmarthomeStatePayload): SmarthomeStatePayload {
    return {
        lamps: payload.lamps ?? previousState?.lamps ?? initialState.lamps,
        lampColors: payload.lampColors ?? previousState?.lampColors ?? initialState.lampColors,
        wallLightColors: payload.wallLightColors ?? previousState?.wallLightColors ?? initialState.wallLightColors,
        shadesOpen: payload.shadesOpen ?? previousState?.shadesOpen ?? initialState.shadesOpen,
        airConditioningOn: payload.airConditioningOn ?? previousState?.airConditioningOn ?? initialState.airConditioningOn,
    }
}

const lightConfigs: OverlayConfig[] = [
    { id: "d1", src: ceilingLight1Image, maskSrc: ceilingLight1MaskImage, color: "#ffd15c" },
    { id: "d2", src: ceilingLight2Image, maskSrc: ceilingLight2MaskImage, color: "#ffb347" },
    { id: "a", src: outsideLightImage, maskSrc: outsideLightMaskImage, color: "#8dd8ff" },
    { id: "w1", src: wallLight1Image, maskSrc: wallLight1MaskImage, color: "#fff2b3" },
    { id: "w2", src: wallLight2Image, maskSrc: wallLight2MaskImage, color: "#ffe38a" },
    { id: "w3", src: wallLight3Image, maskSrc: wallLight3MaskImage, color: "#d7ff7a" },
    { id: "w4", src: wallLight4Image, maskSrc: wallLight4MaskImage, color: "#ff8a80" },
    { id: "w5", src: wallLight5Image, maskSrc: wallLight5MaskImage, color: "#7ad7ff" },
    { id: "w6", src: wallLight6Image, maskSrc: wallLight6MaskImage, color: "#f5ff9f" },
    { id: "w7", src: wallLight7Image, maskSrc: wallLight7MaskImage, color: "#d2a1ff" },
    { id: "w8", src: wallLight8Image, maskSrc: wallLight8MaskImage, color: "#ffffff" },
]

const climateConfig: OverlayConfig = {
    id: "klima",
    src: climateImage,
    color: "#62b6ff",
}

const buttonRows = [
    [0, 2, 4, 6, 8],
    [1, 3, 5, 7, 9],
]

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error(`Image could not be loaded: ${src}`))
        image.src = src
    })
}

function hexToRgb(hex: string) {
    const normalized = hex.replace("#", "")
    const value = normalized.length === 3
        ? normalized.split("").map((char) => char + char).join("")
        : normalized
    const numeric = Number.parseInt(value, 16)

    return {
        r: (numeric >> 16) & 255,
        g: (numeric >> 8) & 255,
        b: numeric & 255,
    }
}

function colorNumberToHex(color: number) {
    return `#${color.toString(16).padStart(6, "0")}`
}

function resolveRenderStyle(color: string, isWallLight: boolean): RenderStyle {
    const baseLightAlpha = isWallLight ? WALL_LIGHT_OVERLAY_ALPHA : 1
    const baseMaskAlpha = MASK_OVERLAY_ALPHA
    const normalizedColor = color.toLowerCase()

    if (normalizedColor === "#909090") {
        return {
            color: "#ffffff",
            lightAlpha: baseLightAlpha * 0.75,
            maskAlpha: baseMaskAlpha * 0.75,
        }
    }

    if (normalizedColor === "#505050") {
        return {
            color: "#ffffff",
            lightAlpha: baseLightAlpha * 0.5,
            maskAlpha: baseMaskAlpha * 0.5,
        }
    }

    return {
        color,
        lightAlpha: baseLightAlpha,
        maskAlpha: baseMaskAlpha,
    }
}

function buildTintedCanvas(canvasWidth: number, canvasHeight: number, mapImage: HTMLImageElement, color: string) {
    const offscreen = document.createElement("canvas")
    offscreen.width = canvasWidth
    offscreen.height = canvasHeight

    const context = offscreen.getContext("2d", { willReadFrequently: true })
    if (!context) {
        return offscreen
    }

    context.clearRect(0, 0, offscreen.width, offscreen.height)
    context.drawImage(mapImage, 0, 0, offscreen.width, offscreen.height)

    const imageData = context.getImageData(0, 0, offscreen.width, offscreen.height)
    const data = imageData.data
    const { r, g, b } = hexToRgb(color)

    for (let index = 0; index < data.length; index += 4) {
        const sourceR = data[index]
        const sourceG = data[index + 1]
        const sourceB = data[index + 2]
        const sourceA = data[index + 3]

        if (sourceA === 0) {
            continue
        }

        const luminance = (0.2126 * sourceR) + (0.7152 * sourceG) + (0.0722 * sourceB)
        const intensity = luminance / 255
        const alpha = Math.round(sourceA * intensity)

        data[index] = r
        data[index + 1] = g
        data[index + 2] = b
        data[index + 3] = alpha
    }

    context.putImageData(imageData, 0, 0)
    return offscreen
}

function buildMaskedColorCanvas(canvasWidth: number, canvasHeight: number, maskImage: HTMLImageElement, color: string) {
    const offscreen = document.createElement("canvas")
    offscreen.width = canvasWidth
    offscreen.height = canvasHeight

    const context = offscreen.getContext("2d", { willReadFrequently: true })
    if (!context) {
        return offscreen
    }

    context.clearRect(0, 0, offscreen.width, offscreen.height)
    context.drawImage(maskImage, 0, 0, offscreen.width, offscreen.height)

    const imageData = context.getImageData(0, 0, offscreen.width, offscreen.height)
    const data = imageData.data
    const { r, g, b } = hexToRgb(color)

    for (let index = 0; index < data.length; index += 4) {
        const sourceR = data[index]
        const sourceG = data[index + 1]
        const sourceB = data[index + 2]
        const sourceA = data[index + 3]

        if (sourceA === 0) {
            continue
        }

        const isWhiteMask = sourceR >= 250 && sourceG >= 250 && sourceB >= 250
        if (!isWhiteMask) {
            data[index + 3] = 0
            continue
        }

        data[index] = r
        data[index + 1] = g
        data[index + 2] = b
        data[index + 3] = 255
    }

    context.putImageData(imageData, 0, 0)
    return offscreen
}

export function App() {
    const [deviceState, setDeviceState] = useState(initialState)
    const [ceilingLight2UseOpenOverlay, setCeilingLight2UseOpenOverlay] = useState(initialState.shadesOpen)
    const sceneRef = useRef<HTMLDivElement>(null)
    const lightCanvasRef = useRef<HTMLCanvasElement>(null)
    const maskCanvasRef = useRef<HTMLCanvasElement>(null)
    const overlayRegistryRef = useRef(new Map<OverlayId, OverlayEntry>())
    const [assetsReady, setAssetsReady] = useState(false)

    useEffect(() => {
        let cancelled = false

        async function initializeSceneAssets() {
            const baseImage = await loadImage(houseBaseImage)
            const configs = [...lightConfigs, climateConfig]
            const images = await Promise.all(
                configs.map(async (config) => ({
                    config,
                    image: await loadImage(config.src),
                    alternateImage: config.id === "d2" ? await loadImage(ceilingLight2OpenImage) : null,
                    maskImage: config.maskSrc ? await loadImage(config.maskSrc) : null,
                })),
            )

            if (cancelled) {
                return
            }

            const scene = sceneRef.current
            const lightCanvas = lightCanvasRef.current
            const maskCanvas = maskCanvasRef.current

            if (!scene || !lightCanvas || !maskCanvas) {
                return
            }

            const width = baseImage.naturalWidth || baseImage.width
            const height = baseImage.naturalHeight || baseImage.height

            scene.style.aspectRatio = `${width} / ${height}`
            lightCanvas.width = width
            lightCanvas.height = height
            maskCanvas.width = width
            maskCanvas.height = height

            const registry = new Map<OverlayId, OverlayEntry>()
            images.forEach(({ config, image, alternateImage, maskImage }) => {
                registry.set(config.id, {
                    id: config.id,
                    image,
                    defaultImage: image,
                    alternateImage,
                    maskImage,
                    tintedCanvas: null,
                    maskedCanvas: null,
                    tintKey: "",
                    maskKey: "",
                    state: {
                        active: false,
                        color: config.color,
                    },
                })
            })

            overlayRegistryRef.current = registry
            setAssetsReady(true)
        }

        initializeSceneAssets().catch((error) => {
            console.error(error)
        })

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = decodeSmarthomeMessage(event.data)
            if (!message) {
                return
            }

            if (message.type === "state") {
                setDeviceState((previousState) => normalizeState(message.payload, previousState))
            }
        }

        window.addEventListener("message", handleMessage)
        postSmarthomeMessage({
            protocol: "smarthome",
            version: SIMX_PROTOCOL_VERSION,
            type: "hello",
        })

        return () => {
            window.removeEventListener("message", handleMessage)
        }
    }, [])

    useEffect(() => {
        if (deviceState.shadesOpen) {
            setCeilingLight2UseOpenOverlay(true)
            return
        }

        const timeoutId = window.setTimeout(() => {
            setCeilingLight2UseOpenOverlay(false)
        }, CEILING_LIGHT_2_CLOSED_MASK_DELAY_MS)

        return () => {
            window.clearTimeout(timeoutId)
        }
    }, [deviceState.shadesOpen])

    useEffect(() => {
        if (!assetsReady) {
            return
        }

        const lightCanvas = lightCanvasRef.current
        const maskCanvas = maskCanvasRef.current
        if (!lightCanvas || !maskCanvas) {
            return
        }

        const lightContext = lightCanvas.getContext("2d")
        const maskContext = maskCanvas.getContext("2d")
        if (!lightContext || !maskContext) {
            return
        }

        const registry = overlayRegistryRef.current
        const lampColors = deviceState.lampColors ?? initialState.lampColors
        const wallLightColors = deviceState.wallLightColors ?? initialState.wallLightColors
        const directLights = [
            { id: "d1" as const, active: deviceState.lamps[1], color: lampColors[1] ?? 0x000000 },
            { id: "d2" as const, active: deviceState.lamps[0], color: lampColors[0] ?? 0x000000 },
            { id: "a" as const, active: deviceState.lamps[2], color: lampColors[2] ?? 0x000000 },
        ]

        directLights.forEach(({ id, active, color }) => {
            const entry = registry.get(id)
            if (!entry) {
                return
            }

            entry.state.active = active
            entry.state.color = colorNumberToHex(color)
        })

        const ceilingLight2Entry = registry.get("d2")
        if (ceilingLight2Entry?.alternateImage) {
            ceilingLight2Entry.image = ceilingLight2UseOpenOverlay ? ceilingLight2Entry.alternateImage : ceilingLight2Entry.defaultImage
        }

        wallLightColors.forEach((color, index) => {
            const entry = registry.get(`w${index + 1}` as OverlayId)
            if (!entry) {
                return
            }

            entry.state.active = color !== 0
            entry.state.color = colorNumberToHex(color)
        })

        const climateEntry = registry.get("klima")
        if (climateEntry) {
            climateEntry.state.active = deviceState.airConditioningOn
            climateEntry.state.color = climateConfig.color
        }

        lightContext.clearRect(0, 0, lightCanvas.width, lightCanvas.height)
        maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height)

        for (const entry of registry.values()) {
            if (!entry.state.active) {
                continue
            }

            const isWallLight = entry.id.startsWith("w")
            const renderStyle = resolveRenderStyle(entry.state.color, isWallLight)
            const tintKey = `${renderStyle.color}:${entry.image.currentSrc || entry.image.src}:${lightCanvas.width}:${lightCanvas.height}`
            if (!entry.tintedCanvas || entry.tintKey !== tintKey) {
                entry.tintedCanvas = buildTintedCanvas(lightCanvas.width, lightCanvas.height, entry.image, renderStyle.color)
                entry.tintKey = tintKey
            }

            lightContext.globalAlpha = renderStyle.lightAlpha
            lightContext.globalCompositeOperation = "lighter"
            lightContext.drawImage(entry.tintedCanvas, 0, 0)
            lightContext.globalAlpha = 1

            if (entry.maskImage) {
                const maskKey = `${renderStyle.color}:${entry.maskImage.currentSrc || entry.maskImage.src}:${maskCanvas.width}:${maskCanvas.height}`
                if (!entry.maskedCanvas || entry.maskKey !== maskKey) {
                    entry.maskedCanvas = buildMaskedColorCanvas(maskCanvas.width, maskCanvas.height, entry.maskImage, renderStyle.color)
                    entry.maskKey = maskKey
                }

                maskContext.globalAlpha = renderStyle.maskAlpha
                maskContext.globalCompositeOperation = "source-over"
                maskContext.drawImage(entry.maskedCanvas, 0, 0)
                maskContext.globalAlpha = 1
            }
        }

        lightContext.globalCompositeOperation = "source-over"
        maskContext.globalCompositeOperation = "source-over"
    }, [assetsReady, ceilingLight2UseOpenOverlay, deviceState])

    const sendSwitchMessage = (index: number, action: "press" | "release") => {
        postSmarthomeMessage({
            protocol: "smarthome",
            version: SIMX_PROTOCOL_VERSION,
            type: "input",
            payload: {
                source: "switch",
                action,
                index,
            },
        })
    }

    const handlePresenceTrigger = () => {
        postSmarthomeMessage({
            protocol: "smarthome",
            version: SIMX_PROTOCOL_VERSION,
            type: "input",
            payload: {
                source: "presence",
                action: "trigger",
            },
        })
    }

    return (
        <main className="app-shell">
            <div className="scene-shell">
                <div ref={sceneRef} className="scene" aria-label="Smarthome visualisation">
                    <img
                        className={`scene-layer scene-layer-rolladen${deviceState.shadesOpen ? " is-visible" : ""}`}
                        src={shutterImage}
                        alt=""
                    />
                    <img className="scene-layer scene-layer-base" src={houseBaseImage} alt="Smarthome model" />
                    <canvas ref={lightCanvasRef} className="scene-overlays scene-overlays-light" aria-hidden="true" />
                    <canvas ref={maskCanvasRef} className="scene-overlays scene-overlays-mask" aria-hidden="true" />
                </div>
            </div>

            <section className="controls" aria-label="Smarthome controls">
                <div className="button-grid">
                    <button
                        type="button"
                        className="switch-button"
                        onPointerDown={() => sendSwitchMessage(0, "press")}
                        onPointerUp={() => sendSwitchMessage(0, "release")}
                        onPointerLeave={() => sendSwitchMessage(0, "release")}
                    >
                        0
                    </button>
                    <button
                        type="button"
                        className="switch-button"
                        onPointerDown={() => sendSwitchMessage(2, "press")}
                        onPointerUp={() => sendSwitchMessage(2, "release")}
                        onPointerLeave={() => sendSwitchMessage(2, "release")}
                    >
                        2
                    </button>
                    <button type="button" className="presence-button" onClick={handlePresenceTrigger}>
                        <svg className="presence-icon" viewBox="0 0 598.00003 1167.3331" aria-hidden="true" focusable="false">
                            <path d="m 12.640305,1155.2831 c 0,-4.0297 69.0803,-14.4662 112.273245,-16.9621 26.76107,-1.5463 26.03031,0.2185 8.20928,-19.8252 -8.42843,-9.4796 -16.18499,-18.8998 -17.2368,-20.9338 -2.7361,-5.291 -2.36535,-10.5893 1.08761,-15.5427 1.65,-2.367 21.25425,-21.7128 43.56501,-42.9906 22.31076,-21.2779 41.54231,-40.32428 42.73677,-42.32538 1.19447,-2.0012 7.16546,-14.7385 13.26888,-28.3052 18.38929,-40.87568 15.12701,-38.05262 27.4699,-23.7714 5.84435,6.7622 15.08698,17.4271 20.53918,23.6998 5.4522,6.2727 10.79028,12.4495 11.86241,13.7263 1.74238,2.0748 1.3435,3.7026 -3.75733,15.3333 -15.15577,34.55748 -13.94426,32.91678 -47.6146,64.48088 -16.73927,15.6921 -34.27511,31.9765 -38.96854,36.1876 -7.9178,7.104 -8.38237,7.8255 -6.43883,10 4.62678,5.1765 9.00381,15.4991 9.00381,21.2342 0,5.7141 0.0709,5.8071 3.66667,4.8101 2.01666,-0.5592 43.41657,-1.0207 91.99978,-1.0254 48.58322,0 88.33321,-0.1515 88.33333,-0.3261 1.1e-4,-0.1746 -6.9307,-17.8746 -15.4018,-39.3334 -8.4711,-21.4587 -18.47133,-46.9392 -22.22271,-56.6233 -6.82071,-17.6075 -6.82071,-17.6075 -28.09985,-41.33338 -47.45224,-52.90837 -70.73249,-79.96561 -72.60868,-84.38869 -3.154,-7.43549 -1.39795,-18.81975 8.83582,-57.28145 5.16262,-19.40271 9.18495,-35.47928 8.93851,-35.72572 -0.41121,-0.4112 -36.29491,16.07741 -37.39862,17.18472 -0.26606,0.26693 -2.07539,7.68532 -4.02073,16.48532 -7.12432,32.22768 -11.40197,48.83209 -13.34363,51.79544 -5.46303,8.33764 -21.03234,11.46556 -31.21439,6.27106 -5.59305,-2.85336 -9.4637,-9.30147 -9.4637,-15.76558 0,-2.17951 3.92315,-22.18883 8.7181,-44.46516 6.72889,-31.26097 9.48062,-41.65743 12.05997,-45.56445 2.95514,-4.47625 7.30801,-6.9978 37.61523,-21.78988 67.99735,-33.18757 66.77707,-32.81823 87.72917,-26.55316 41.26072,12.33774 46.24055,14.87171 53.31089,27.12711 1.99202,3.45288 10.76176,18.32977 19.48831,33.05977 l 15.86646,26.7818 29.60592,11.76806 c 37.60058,14.94585 39.4541,15.96737 43.50093,23.97451 2.96977,5.87605 3.09662,6.88045 1.58383,12.54073 -2.72886,10.21034 -10.17624,16.15308 -20.24289,16.15308 -3.90285,0 -14.56726,-3.61011 -35.73288,-12.09628 -47.65537,-19.107 -45.6955,-17.89815 -57.63516,-35.54939 -9.73704,-14.39493 -11.86789,-16.30433 -11.86789,-10.63445 0,1.43482 -3.29052,16.60068 -7.31226,33.70191 l -7.31227,31.09314 25.22815,34.4092 c 13.87548,18.92506 27.14129,37.56256 29.47957,41.41666 2.33827,3.8542 12.75347,29.05418 23.14488,55.99998 l 18.89347,48.9925 14.60589,-0.4421 c 13.27125,-0.4018 15.14133,-0.1551 20.46545,2.6999 6.02392,3.2302 10.80711,9.9613 10.80711,15.2083 0,5.0349 -5.03571,9.4671 -18.77397,16.5239 -7.39326,3.7977 -13.23551,7.1117 -12.98279,7.3644 0.25273,0.2527 11.55139,1.1116 25.10813,1.9086 30.11081,1.7702 37.37587,2.3707 58.64863,4.8473 32.57622,3.7926 68.53172,10.6174 67.20932,12.757 -0.90827,1.4697 -575.209295,1.4873 -575.209295,0.018 z M 316.97846,750.52753 c -13.42762,-4.37601 -26.05514,-15.62056 -32.15795,-28.63601 -3.06205,-6.53044 -3.51355,-9.2067 -3.51355,-20.82668 0,-11.87182 0.42006,-14.24274 3.83222,-21.62983 4.69545,-10.16532 15.10017,-20.41352 25.83092,-25.44232 6.72767,-3.15281 9.3086,-3.59451 21.00352,-3.59451 11.70352,0 14.27346,0.44054 21.02433,3.60404 9.81573,4.5997 20.69821,15.48603 25.72017,25.72929 3.54586,7.23244 3.92217,9.27926 3.92217,21.33333 0,11.70352 -0.44055,14.27345 -3.60404,21.02433 -4.71027,10.05168 -16.15807,21.44415 -26.03827,25.91244 -9.38011,4.24212 -26.96873,5.47555 -36.01952,2.52592 z M 277.97363,588.27699 C 212.38992,580.99568 139.8351,550.5272 86.189405,507.73962 c -12.29816,-9.80897 -17.13085,-17.47313 -15.55161,-24.66333 1.2883,-5.86562 7.77714,-13.95096 13.29924,-16.57137 4.93112,-2.33997 4.9503,-2.33738 10.69636,1.44122 3.16601,2.08196 10.737565,7.38538 16.825675,11.78538 41.56005,30.03631 85.07797,49.66427 134.51456,60.67032 42.7503,9.51748 92.17405,10.45142 138.70334,2.621 47.90101,-8.06127 103.88454,-30.65258 145.81542,-58.84162 33.82358,-22.73871 29.25727,-20.4423 34.98734,-17.59529 7.81071,3.88078 13.16055,11.50167 13.16055,18.74732 0,5.5291 -0.55064,6.52635 -6.74165,12.20957 -17.64391,16.19675 -47.94233,36.58231 -74.59168,50.18722 -39.22925,20.02714 -76.24822,31.87945 -121.33333,38.84712 -15.99049,2.47124 -80.90943,3.59728 -97.99999,1.69983 z m 30.66666,-83.53117 c -60.1864,-2.21559 -122.14082,-25.23037 -171.34335,-63.6505 -12.5734,-9.81802 -18.91839,-16.61958 -20.17515,-21.6269 -1.09945,-4.38059 3.54756,-13.73569 9.17525,-18.47108 6.30136,-5.30224 10.9145,-4.38594 21.6766,4.30559 31.15624,25.16196 74.46478,45.79756 112.66666,53.68326 19.79812,4.08676 33.56719,5.412 56.23006,5.412 61.03516,0 115.44454,-17.42391 173.34187,-55.51052 7.0979,-4.66921 14.16131,-8.48948 15.69645,-8.48948 3.84206,0 14.27989,9.9246 16.03689,15.24835 2.19188,6.64149 0.003,10.34296 -11.58259,19.58545 -32.88483,26.23437 -78.86997,49.25753 -120.99451,60.57775 -21.77232,5.85092 -57.4011,9.79479 -80.72818,8.93608 z m -18.54613,-84.41529 c -40.65351,-5.08538 -87.27446,-26.00771 -114.85847,-51.54564 -9.02805,-8.35838 -10.27863,-11.37268 -7.48863,-18.05008 2.65546,-6.3554 11.25935,-15.66995 14.47441,-15.66995 1.43231,0 7.51249,3.77369 13.51151,8.38598 14.10561,10.84496 19.19415,14.05721 34.23137,21.60936 34.63997,17.39724 72.02742,23.79545 109.34261,18.71208 38.35422,-5.22492 71.57511,-19.75132 110.48274,-48.31046 5.07511,-3.72525 18.85058,9.35108 18.85058,17.89387 0,5.02698 -10.03052,14.50848 -27.9734,26.44228 -29.01294,19.29649 -57.43357,31.63787 -87.35992,37.93518 -15.3766,3.23565 -47.5441,4.5574 -63.2128,2.59738 z m 3.63141,-77.36965 c -25.93233,-3.80411 -55.32716,-17.44418 -71.57647,-33.21361 -7.87878,-7.6461 -6.95422,-15.54805 2.9414,-25.13926 4.34722,-4.2135 4.34722,-4.2135 12.73308,1.23552 27.20065,17.67462 53.1642,25.00143 83.32125,23.51291 26.11783,-1.28914 52.11209,-10.59849 78.33548,-28.05436 3.43102,-2.28389 3.60085,-2.25504 7.86961,1.33688 2.3996,2.01913 5.49558,6.23174 6.87996,9.36136 3.38357,7.64912 1.86774,10.3121 -11.65618,20.4774 -31.97484,24.03399 -73.51243,35.66668 -108.84813,30.48316 z m -3.75194,-114.49635 c -77.83928,-6.59823 -138.99026,-32.87044 -168.79462,-72.51901 -6.56396,-8.73199 -13.87204,-22.15654 -13.87204,-25.48219 0,-6.98305 59.71633,-24.66694 109.99999,-32.574461 38.49467,-6.05361 55.82735,-7.35356 98,-7.35003 52.1106,0.004 88.71773,3.83118 133.99999,14.008001 31.16168,7.00333 74,21.63135 74,25.26882 0,2.4698 -4.87295,12.14398 -10.06568,19.9832 -20.12325,30.37915 -61.35629,55.66031 -111.9151,68.61835 -33.25635,8.52348 -79.79339,12.72251 -111.35254,10.04732 z m -4.13199,-64.90713 c 5.86801,-0.71631 5.86801,-0.71631 5,-18.81523 -0.47741,-9.95441 -0.86801,-21.39774 -0.86801,-25.42962 0,-7.33069 0,-7.33069 -20.26914,-6.45337 -11.14803,0.48252 -20.67273,1.3262 -21.16599,1.87484 -1.01734,1.13153 0.39486,15.58893 3.5769,36.61849 l 2.1619,14.28764 12.84816,-0.68322 c 7.06649,-0.37577 15.48877,-1.00556 18.71618,-1.39953 z M 79.375105,130.49545 c -1.79587,-0.99454 -3.70369,-2.92328 -4.23962,-4.28608 -0.53593,-1.36281 -1.01659,-14.0261 -1.06814,-28.140651 -0.0937,-25.66283 -0.0937,-25.66283 4.46162,-30.70503 10.64333,-11.7809 53.310795,-29.479346 96.778005,-40.143485 88.44251,-21.6982745 201.12726,-20.7254315 288.66665,2.492149 38.13854,10.115272 73.45147,25.123676 84.95628,36.107406 6.37704,6.08822 6.37704,6.08822 6.37704,32.42099 0,27.405161 -0.59343,30.809781 -5.69941,32.698611 -2.32677,0.86073 -4.06639,-0.13167 -9.35312,-5.33567 C 525.37043,110.95264 484.78999,96.576769 429.97362,86.536049 345.26524,71.019999 242.74578,74.125219 162.6403,94.633309 118.81561,105.85302 88.511755,119.63416 85.280905,129.81366 c -0.96084,3.02735 -1.54801,3.09513 -5.9058,0.68179 z" />
                        </svg>
                    </button>
                    {buttonRows[0].slice(2).map((index) => (
                        <button
                            key={`top-${index}`}
                            type="button"
                            className="switch-button"
                            onPointerDown={() => sendSwitchMessage(index, "press")}
                            onPointerUp={() => sendSwitchMessage(index, "release")}
                            onPointerLeave={() => sendSwitchMessage(index, "release")}
                        >
                            {index}
                        </button>
                    ))}
                    {buttonRows[1].map((index) => (
                        <button
                            key={`bottom-${index}`}
                            type="button"
                            className="switch-button"
                            onPointerDown={() => sendSwitchMessage(index, "press")}
                            onPointerUp={() => sendSwitchMessage(index, "release")}
                            onPointerLeave={() => sendSwitchMessage(index, "release")}
                        >
                            {index}
                        </button>
                    ))}
                </div>
            </section>
        </main>
    )
}
