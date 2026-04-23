// A Calliope MakeCode extension for a custom-built smarthome model
// Theo-Koch-Schule Gruenberg 2024-2026
// MIT License

//% weight=2 color=#AA278D icon="\uf015" block="Smarthome"
namespace smarthome {
    const SIMX_CHANNEL = "met-theokoch-schule/pxt-calliope-smarthome"
    const SIMX_PROTOCOL_VERSION = 1

    export enum TouchSwitch {
        //% block="S0"
        S0 = 0b000000000001,
        //% block="S1"
        S1 = 0b000000000010,
        //% block="S2"
        S2 = 0b000000000100,
        //% block="S3"
        S3 = 0b000000001000,
        //% block="S4"
        S4 = 0b000000010000,
        //% block="S5"
        S5 = 0b000000100000,
        //% block="S6"
        S6 = 0b000001000000,
        //% block="S7"
        S7 = 0b000010000000,
        //% block="S8"
        S8 = 0b000100000000,
        //% block="S9"
        S9 = 0b001000000000,
    }

    export enum TouchPressType {
        //% block="short"
        //% block.loc.de="kurz"
        Short = 1,
        //% block="long"
        //% block.loc.de="lang"
        Long = 2,
    }

    export enum PowerState {
        //% block="on"
        //% block.loc.de="an"
        On = 1,
        //% block="off"
        //% block.loc.de="aus"
        Off = 2,
    }

    export enum ShadeState {
        //% block="open"
        //% block.loc.de="öffnen"
        Open = 1,
        //% block="close"
        //% block.loc.de="schließen"
        Close = 2,
    }

    export enum LampName {
        //% block="ceiling lamp 1"
        //% block.loc.de="Deckenlampe 1"
        CeilingLamp1 = 1,
        //% block="ceiling lamp 2"
        //% block.loc.de="Deckenlampe 2"
        CeilingLamp2 = 0,
        //% block="outside lamp"
        //% block.loc.de="Außenlampe"
        OutsideLamp = 2,
        //% block="wall lamp"
        //% block.loc.de="Wandlampe"
        WallLamp = 3,
    }

    let shadesOpen = true
    let airConditioningOn = false
    let lampStates = [false, false, false, false]
    let lampColors = [0x000000, 0x000000, 0x000000]
    let wallLightColors = [0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000]

    let lightStrip: neopixel.Strip
    let wallLamp: neopixel.Strip

    const MPR121_ADDRESS = 0x5a
    const TOUCH_STATUS_PAUSE_BETWEEN_READ = 50
    const LONG_PRESS_DURATION_MS = 750
    const PRESENCE_DETECTED_ID = 2147
    const MPR121_TOUCH_SENSOR_TOUCHED_ID = 2148
    const MPR121_TOUCH_SENSOR_RELEASED_ID = 2149
    const MPR121_TOUCH_SENSOR_SHORT_PRESSED_ID = 2150
    const MPR121_TOUCH_SENSOR_LONG_PRESSED_ID = 2151

    interface TouchController {
        lastTouchStatus: number
        lastEventValue: number
    }

    interface PresenceDetector {
        lastPresenceDetection: boolean
        enabled: boolean
    }

    let touchController: TouchController
    let presenceDetector: PresenceDetector
    let touchPressed = [false, false, false, false, false, false, false, false, false, false, false, false]
    let touchLongPressNotified = [false, false, false, false, false, false, false, false, false, false, false, false]
    let touchPressGeneration = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    interface SimxEnvelope {
        protocol: "smarthome"
        version: number
        type: string
    }

    interface SimxStateMessage extends SimxEnvelope {
        type: "state"
        payload: {
            lamps: boolean[]
            lampColors: number[]
            wallLightColors: number[]
            shadesOpen: boolean
            airConditioningOn: boolean
        }
    }

    interface SimxInputMessage extends SimxEnvelope {
        type: "input"
        payload: {
            source: "switch" | "presence"
            action: "press" | "release" | "shortPress" | "longPress" | "trigger"
            index?: number
        }
    }

    function ensureLightsInitialized() {
        if (lightStrip) {
            return
        }

        lightStrip = neopixel.create(DigitalPin.C8, 11, NeoPixelMode.RGB)
        wallLamp = lightStrip.range(3, 8)
    }

    function sendSimxMessage(message: SimxEnvelope) {
        control.simmessages.send(SIMX_CHANNEL, Buffer.fromUTF8(JSON.stringify(message)), false)
    }

    function syncSimulatorState() {
        const message: SimxStateMessage = {
            protocol: "smarthome",
            version: SIMX_PROTOCOL_VERSION,
            type: "state",
            payload: {
                lamps: [
                    lampStates[0],
                    lampStates[1],
                    lampStates[2],
                    lampStates[3]
                ],
                lampColors: [
                    lampColors[0],
                    lampColors[1],
                    lampColors[2]
                ],
                wallLightColors: [
                    wallLightColors[0],
                    wallLightColors[1],
                    wallLightColors[2],
                    wallLightColors[3],
                    wallLightColors[4],
                    wallLightColors[5],
                    wallLightColors[6],
                    wallLightColors[7]
                ],
                shadesOpen: shadesOpen,
                airConditioningOn: airConditioningOn
            }
        }

        sendSimxMessage(message)
    }

    function touchSwitchToIndex(sensor: TouchSwitch): number {
        let sensorMask = sensor
        let index = 0

        while (sensorMask > 1) {
            sensorMask >>= 1
            index += 1
        }

        return index
    }

    function touchIndexToSwitch(index: number): TouchSwitch {
        return (1 << index) as TouchSwitch
    }

    function touchPressTypeToEventId(pressType: TouchPressType): number {
        if (pressType == TouchPressType.Long) {
            return MPR121_TOUCH_SENSOR_LONG_PRESSED_ID
        }

        return MPR121_TOUCH_SENSOR_SHORT_PRESSED_ID
    }

    function updateWallLampState() {
        lampStates[3] = false
        for (let index = 0; index < wallLightColors.length; index++) {
            if (wallLightColors[index] != 0x000000) {
                lampStates[3] = true
                return
            }
        }
    }

    function raiseTouchLongPress(sensor: TouchSwitch, sensorIndex: number, generation: number) {
        if (touchPressed[sensorIndex] && touchPressGeneration[sensorIndex] == generation && !touchLongPressNotified[sensorIndex]) {
            touchLongPressNotified[sensorIndex] = true
            control.raiseEvent(MPR121_TOUCH_SENSOR_LONG_PRESSED_ID, sensor)
            if (touchController) {
                touchController.lastEventValue = sensor
            }
        }
    }

    function notifyTouchPressed(sensor: TouchSwitch) {
        const sensorIndex = touchSwitchToIndex(sensor)
        touchPressed[sensorIndex] = true
        touchLongPressNotified[sensorIndex] = false
        touchPressGeneration[sensorIndex] += 1
        const generation = touchPressGeneration[sensorIndex]

        control.raiseEvent(MPR121_TOUCH_SENSOR_TOUCHED_ID, sensor)
        if (touchController) {
            touchController.lastEventValue = sensor
        }

        control.inBackground(() => {
            basic.pause(LONG_PRESS_DURATION_MS)
            raiseTouchLongPress(sensor, sensorIndex, generation)
        })
    }

    function notifyTouchReleased(sensor: TouchSwitch) {
        const sensorIndex = touchSwitchToIndex(sensor)
        if (!touchPressed[sensorIndex]) {
            return
        }

        control.raiseEvent(MPR121_TOUCH_SENSOR_RELEASED_ID, sensor)
        if (!touchLongPressNotified[sensorIndex]) {
            control.raiseEvent(MPR121_TOUCH_SENSOR_SHORT_PRESSED_ID, sensor)
        }

        touchPressed[sensorIndex] = false
        touchLongPressNotified[sensorIndex] = false
        if (touchController) {
            touchController.lastEventValue = sensor
        }
    }

    function handleSimxMessage(data: Buffer) {
        const message = JSON.parse(data.toString()) as SimxEnvelope
        if (!message || message.protocol != "smarthome" || message.version != SIMX_PROTOCOL_VERSION) {
            return
        }

        if (message.type == "hello") {
            syncSimulatorState()
            return
        }

        if (message.type != "input") {
            return
        }

        const input = message as SimxInputMessage
        if (input.payload.source == "presence" && input.payload.action == "trigger") {
            control.raiseEvent(PRESENCE_DETECTED_ID, 0)
            return
        }

        if (input.payload.source != "switch" || input.payload.index === undefined) {
            return
        }

        const sensor = touchIndexToSwitch(input.payload.index)

        if (input.payload.action == "shortPress") {
            control.raiseEvent(MPR121_TOUCH_SENSOR_SHORT_PRESSED_ID, sensor)
            if (touchController) {
                touchController.lastEventValue = sensor
            }
            return
        }

        if (input.payload.action == "longPress") {
            control.raiseEvent(MPR121_TOUCH_SENSOR_LONG_PRESSED_ID, sensor)
            if (touchController) {
                touchController.lastEventValue = sensor
            }
            return
        }

        if (input.payload.action == "press") {
            notifyTouchPressed(sensor)
            return
        }

        if (input.payload.action == "release") {
            notifyTouchReleased(sensor)
        }
    }

    function registerSimx() {
        control.simmessages.onReceived(SIMX_CHANNEL, handleSimxMessage)
        sendSimxMessage({
            protocol: "smarthome",
            version: SIMX_PROTOCOL_VERSION,
            type: "hello"
        })
        syncSimulatorState()
    }

    function initializeSmarthome() {
        ensureLightsInitialized()

        motors.dualMotorPower(Motor.M0, 0)
        airConditioningOn = false

        lightStrip.clear()
        lightStrip.show()
        lampStates = [false, false, false, false]
        lampColors = [0x000000, 0x000000, 0x000000]
        wallLightColors = [0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000]

        pins.servoWritePin(AnalogPin.C16, 0)
        basic.pause(800)
        pins.servoSetPulse(AnalogPin.C16, 0)
        shadesOpen = true

        syncSimulatorState()
    }

    /**
     * Opens or closes the shades.
     */
    //% blockId=smarthome_switch_shades
    //% block="$state shades"
    //% block.loc.de="Rolladen $state"
    //% inlineInputMode=inline
    export function switchShades(state: ShadeState = ShadeState.Open) {
        if (state === ShadeState.Open) {
            pins.servoWritePin(AnalogPin.C16, 0)
            basic.pause(800)
            pins.servoSetPulse(AnalogPin.C16, 0)
            shadesOpen = true
        } else {
            pins.servoWritePin(AnalogPin.C16, 180)
            basic.pause(800)
            pins.servoSetPulse(AnalogPin.C16, 0)
            shadesOpen = false
        }

        syncSimulatorState()
    }

    /**
     * Returns whether the shades are open.
     */
    //% blockId=smarthome_get_shades_status
    //% block="shade is open"
    //% block.loc.de="Rolladen ist offen"
    //% weight=5
    //% group="States"
    //% group.loc.de="Zustände"
    export function getShadesStatus(): boolean {
        return shadesOpen
    }

    /**
     * Switches the air conditioning on or off.
     */
    //% blockId=smarthome_switch_air_conditioning
    //% block="switch aircondition $state"
    //% block.loc.de="schalte die Klimaanlage $state"
    //% inlineInputMode=inline
    //% weight=5
    export function switchAirConditioning(state: PowerState = PowerState.On) {
        if (state === PowerState.On) {
            motors.dualMotorPower(Motor.M0, 100)
            airConditioningOn = true
        } else {
            motors.dualMotorPower(Motor.M0, 0)
            airConditioningOn = false
        }

        syncSimulatorState()
    }

    /**
     * Sets the air conditioning power in percent.
     */
    //% blockId=smarthome_set_air_conditioning_power
    //% block="set aircondition to %power %"
    //% block.loc.de="setze Klimaanlage auf %power %"
    //% power.defl=80
    //% power.min=25 power.max=100
    export function setAirConditioningPower(power: number) {
        if (power < 25) {
            power = 25
        }
        if (power > 100) {
            power = 100
        }

        motors.dualMotorPower(Motor.M0, power)
        airConditioningOn = true
        syncSimulatorState()
    }

    /**
     * Returns whether the air conditioning is on.
     */
    //% blockId=smarthome_get_air_conditioning_status
    //% block="aircondition is on"
    //% block.loc.de="Klimaanlage ist an"
    //% weight=5
    //% group="States"
    //% group.loc.de="Zustände"
    export function getAirConditioningStatus(): boolean {
        return airConditioningOn
    }

    /**
     * Sets the wall lamp pixels individually.
     */
    //% blockId=smarthome_show_wall_lamp_color_pixel
    //% block="set wall light to $color1 $color2 $color3 $color4 $color5 $color6 $color7 $color8"
    //% block.loc.de="setze Wandlampe auf $color1 $color2 $color3 $color4 $color5 $color6 $color7 $color8"
    //% color1.shadow="smarthome_color_number_picker" color1.defl=0xff0000
    //% color2.shadow="smarthome_color_number_picker" color2.defl=0xff8000
    //% color3.shadow="smarthome_color_number_picker" color3.defl=0xffff00
    //% color4.shadow="smarthome_color_number_picker" color4.defl=0x00ff00
    //% color5.shadow="smarthome_color_number_picker" color5.defl=0x00ffff
    //% color6.shadow="smarthome_color_number_picker" color6.defl=0x0000ff
    //% color7.shadow="smarthome_color_number_picker" color7.defl=0xff00ff
    //% color8.shadow="smarthome_color_number_picker" color8.defl=0xff0080
    //% inlineInputMode=inline
    export function showWallLampColorPixel(
        color1: number,
        color2: number,
        color3: number,
        color4: number,
        color5: number,
        color6: number,
        color7: number,
        color8: number
    ) {
        ensureLightsInitialized()

        lightStrip.setBrightness(20)
        lightStrip.setPixelColor(3, color1)
        lightStrip.setPixelColor(4, color2)
        lightStrip.setPixelColor(5, color3)
        lightStrip.setPixelColor(6, color4)
        lightStrip.setPixelColor(7, color5)
        lightStrip.setPixelColor(8, color6)
        lightStrip.setPixelColor(9, color7)
        lightStrip.setPixelColor(10, color8)

        wallLightColors[0] = color1
        wallLightColors[1] = color2
        wallLightColors[2] = color3
        wallLightColors[3] = color4
        wallLightColors[4] = color5
        wallLightColors[5] = color6
        wallLightColors[6] = color7
        wallLightColors[7] = color8

        lightStrip.show()
        lightStrip.setBrightness(255)

        lampStates[3] =
            color1 != 0x000000 ||
            color2 != 0x000000 ||
            color3 != 0x000000 ||
            color4 != 0x000000 ||
            color5 != 0x000000 ||
            color6 != 0x000000 ||
            color7 != 0x000000 ||
            color8 != 0x000000

        syncSimulatorState()
    }

    /**
     * Sets one wall lamp LED to a color.
     */
    //% blockId=smarthome_set_wall_lamp_led_color
    //% block="set wall lamp LED $led to $color"
    //% block.loc.de="setze Wandlampe LED $led auf $color"
    //% led.shadow=math_number led.defl=0 led.min=0 led.max=7
    //% color.shadow="smarthome_color_number_picker" color.defl=0xffffff
    //% inlineInputMode=inline
    //% advanced=true
    export function setWallLampLedColor(led: number, color: number) {
        ensureLightsInitialized()

        led = Math.round(led)
        if (led < 0) {
            led = 0
        }
        if (led > 7) {
            led = 7
        }

        const wallLightIndex = led
        lightStrip.setBrightness(20)
        lightStrip.setPixelColor(wallLightIndex + 3, color)
        wallLightColors[wallLightIndex] = color
        updateWallLampState()

        lightStrip.show()
        lightStrip.setBrightness(255)
        syncSimulatorState()
    }

    /**
     * Switches a lamp to a color.
     */
    //% blockId=smarthome_show_lamp_color
    //% block="set $lamp to $color"
    //% block.loc.de="setze $lamp auf $color"
    //% color.shadow="smarthome_color_number_picker" color.defl='#ffffff'
    //% inlineInputMode=inline
    export function showLampColor(lamp: LampName = LampName.CeilingLamp1, color: number) {
        ensureLightsInitialized()

        if (lamp < 3) {
            lightStrip.setPixelColor(lamp, color)
            lampStates[lamp] = color != 0x000000
            lampColors[lamp] = color
        } else {
            wallLamp.setBrightness(20)
            wallLamp.showColor(color)
            lampStates[3] = color != 0x000000
            wallLightColors[0] = color
            wallLightColors[1] = color
            wallLightColors[2] = color
            wallLightColors[3] = color
            wallLightColors[4] = color
            wallLightColors[5] = color
            wallLightColors[6] = color
            wallLightColors[7] = color
            updateWallLampState()
        }

        lightStrip.show()
        wallLamp.setBrightness(255)
        syncSimulatorState()
    }

    /**
     * Switches a lamp off.
     */
    //% blockId=smarthome_switch_lamp_off
    //% block="switch $lamp off"
    //% block.loc.de="schalte $lamp aus"
    //% inlineInputMode=inline
    export function switchLampOff(lamp: LampName = LampName.CeilingLamp1) {
        ensureLightsInitialized()

        if (lamp < 3) {
            lightStrip.setPixelColor(lamp, 0x000000)
            lampColors[lamp] = 0x000000
        } else {
            wallLamp.showColor(0x000000)
            wallLightColors[0] = 0x000000
            wallLightColors[1] = 0x000000
            wallLightColors[2] = 0x000000
            wallLightColors[3] = 0x000000
            wallLightColors[4] = 0x000000
            wallLightColors[5] = 0x000000
            wallLightColors[6] = 0x000000
            wallLightColors[7] = 0x000000
            updateWallLampState()
        }

        if (lamp < 3) {
            lampStates[lamp] = false
        }
        lightStrip.show()
        syncSimulatorState()
    }

    /**
     * Returns the status of a lamp.
     */
    //% blockId=smarthome_get_lamp_status
    //% block="$lamp is on"
    //% block.loc.de="$lamp ist an"
    //% inlineInputMode=inline
    //% weight=5
    //% group="States"
    //% group.loc.de="Zustände"
    export function getLampStatus(lamp: LampName = LampName.CeilingLamp1): boolean {
        return lampStates[lamp]
    }

    /**
     * Custom color picker.
     */
    //% blockId=smarthome_color_number_picker
    //% block="%value"
    //% blockHidden=true
    //% shim=TD_ID
    //% value.fieldEditor="colornumber" value.fieldOptions.decompileLiterals=true
    //% weight=150
    //% value.fieldOptions.colours='["#ff0000","#ff8000","#ffff00","#00ff00","#00ffff","#0000ff","#ff00ff","#ff0080","#ffffff","#909090","#505050","#000000"]'
    //% value.fieldOptions.columns=4 value.fieldOptions.className='rgbColorPicker'
    export function colorNumberPicker(value: number) {
        return value
    }

    /**
     * Initializes the touch controller.
     */
    //% blockId=mpr121_touch_init
    //% block="initialize touch sensor"
    //% block.loc.de="initialisiere touch-Sensor"
    //% weight=70
    function initTouchController() {
        if (touchController) {
            return
        }

        touchController = {
            lastTouchStatus: 0,
            lastEventValue: 0,
        }

        const address = MPR121_ADDRESS
        mpr121.reset(address)
        mpr121.stop(address)

        mpr121.configure(address, mpr121.Config.MHDR, 0x01)
        mpr121.configure(address, mpr121.Config.NHDR, 0x01)
        mpr121.configure(address, mpr121.Config.NCLR, 0x10)
        mpr121.configure(address, mpr121.Config.FDLR, 0x20)

        mpr121.configure(address, mpr121.Config.MHDF, 0x01)
        mpr121.configure(address, mpr121.Config.NHDF, 0x01)
        mpr121.configure(address, mpr121.Config.NCLF, 0x10)
        mpr121.configure(address, mpr121.Config.FDLF, 0x20)

        mpr121.configure(address, mpr121.Config.NHDT, 0x01)
        mpr121.configure(address, mpr121.Config.NCLT, 0x10)
        mpr121.configure(address, mpr121.Config.FDLT, 0xff)

        mpr121.configure(address, mpr121.Config.MHDPROXR, 0x0f)
        mpr121.configure(address, mpr121.Config.NHDPROXR, 0x0f)
        mpr121.configure(address, mpr121.Config.NCLPROXR, 0x00)
        mpr121.configure(address, mpr121.Config.FDLPROXR, 0x00)
        mpr121.configure(address, mpr121.Config.MHDPROXF, 0x01)
        mpr121.configure(address, mpr121.Config.NHDPROXF, 0x01)
        mpr121.configure(address, mpr121.Config.NCLPROXF, 0xff)
        mpr121.configure(address, mpr121.Config.FDLPROXF, 0xff)
        mpr121.configure(address, mpr121.Config.NHDPROXT, 0x00)
        mpr121.configure(address, mpr121.Config.NCLPROXT, 0x00)
        mpr121.configure(address, mpr121.Config.FDLPROXT, 0x00)

        mpr121.configure(address, mpr121.Config.DTR, 0x11)
        mpr121.configure(address, mpr121.Config.AFE1, 0xff)
        mpr121.configure(address, mpr121.Config.AFE2, 0x30)

        mpr121.configure(address, mpr121.Config.AUTO_CONFIG_0, 0x00)
        mpr121.configure(address, mpr121.Config.AUTO_CONFIG_1, 0x00)
        mpr121.configure(address, mpr121.Config.AUTO_CONFIG_USL, 0x00)
        mpr121.configure(address, mpr121.Config.AUTO_CONFIG_LSL, 0x00)
        mpr121.configure(address, mpr121.Config.AUTO_CONFIG_TL, 0x00)

        mpr121.configureThresholds(address, 60, 20)
        mpr121.start(
            address,
            mpr121.CalibrationLock.BaselineTrackingAndInitialize,
            mpr121.Proximity.DISABLED,
            mpr121.Touch.ELE_0_TO_11
        )

        control.inBackground(detectAndNotifyTouchEvents)
    }

    function detectAndNotifyTouchEvents() {
        let previousTouchStatus = 0

        while (true) {
            const touchStatus = mpr121.readTouchStatus(MPR121_ADDRESS)
            touchController.lastTouchStatus = touchStatus

            for (let touchSensorBit = 1; touchSensorBit <= 2048; touchSensorBit <<= 1) {
                if ((touchSensorBit & touchStatus) !== 0 && (touchSensorBit & previousTouchStatus) === 0) {
                    notifyTouchPressed(touchSensorBit as TouchSwitch)
                }

                if ((touchSensorBit & touchStatus) === 0 && (touchSensorBit & previousTouchStatus) !== 0) {
                    notifyTouchReleased(touchSensorBit as TouchSwitch)
                }
            }

            previousTouchStatus = touchStatus
            basic.pause(TOUCH_STATUS_PAUSE_BETWEEN_READ)
        }
    }

    function setupContextAndNotify(handler: () => void) {
        touchController.lastEventValue = control.eventValue()
        handler()
    }

    /**
     * Runs code when a specific touch switch is pressed.
     */
    //% blockId=mpr121_touch_on_touch_sensor_down
    //% block="when switch | %sensor | pressed"
    //% block.loc.de="wenn Schalter | %sensor | gedrückt"
    //% sensor.fieldEditor="gridpicker" sensor.fieldOptions.columns=3
    //% sensor.fieldOptions.tooltips="false"
    //% weight=65
    export function onTouchSensorTouched(sensor: TouchSwitch, handler: () => void) {
        initTouchController()
        control.onEvent(MPR121_TOUCH_SENSOR_TOUCHED_ID, sensor, () => {
            setupContextAndNotify(handler)
        })
    }

    /**
     * Runs code when a specific touch switch is pressed short or long.
     */
    //% blockId=mpr121_touch_on_touch_sensor_pressed
    //% block="when switch | %sensor | %pressType | pressed"
    //% block.loc.de="wenn Schalter | %sensor | %pressType | gedrückt"
    //% sensor.fieldEditor="gridpicker" sensor.fieldOptions.columns=3
    //% sensor.fieldOptions.tooltips="false"
    //% weight=64
    //% advanced=true
    export function onTouchSensorPressed(sensor: TouchSwitch, pressType: TouchPressType, handler: () => void) {
        initTouchController()
        control.onEvent(touchPressTypeToEventId(pressType), sensor, () => {
            setupContextAndNotify(handler)
        })
    }

    /**
     * Initializes the presence detector.
     */
    //% blockId=presence_init
    //% block="initialize presence sensor"
    //% block.loc.de="initialisiere Präsenz-Sensor"
    //% weight=70
    function initPresenceDetector() {
        if (presenceDetector) {
            return
        }

        presenceDetector = {
            lastPresenceDetection: false,
            enabled: false,
        }

        presenceDetector.enabled = Rangefinder.init()
        if (presenceDetector.enabled) {
            control.inBackground(detectAndNotifyPresenceDetector)
        }
    }

    function detectAndNotifyPresenceDetector() {
        let previousPresenceStatus = false
        let distance = Rangefinder.distance()

        if (distance == 0) {
            return
        } else {
            const startDistance = distance
            let previousPresenceTime = control.millis()

            while (true) {
                distance = Rangefinder.distance()

                if (!previousPresenceStatus && distance < startDistance - 5) {
                    control.raiseEvent(PRESENCE_DETECTED_ID, 0)
                    previousPresenceStatus = true
                    previousPresenceTime = control.millis()
                }

                if (previousPresenceStatus && previousPresenceTime < control.millis() - 1000 && distance >= startDistance - 5) {
                    previousPresenceStatus = false
                }
            }
        }
    }

    /**
     * Runs code when presence is detected.
     */
    //% blockId=smarthome_presence_detected
    //% block="when presence detected"
    //% block.loc.de="wenn Präsenz gemeldet"
    //% weight=65
    export function onPresenceDetected(handler: () => void) {
        initPresenceDetector()
        control.onEvent(PRESENCE_DETECTED_ID, EventBusValue.MICROBIT_EVT_ANY, () => {
            handler()
        })
    }

    // Communication module for the MPR121 capacitive touch controller.
    export namespace mpr121 {
        export enum CalibrationLock {
            BaselineTrackingOn = 0b00,
            BaselineTrackingOff = 0b01,
            BaselineTrackingAndInitializeFirst5MSB = 0b10,
            BaselineTrackingAndInitialize = 0b11,
        }

        export enum Proximity {
            DISABLED = 0b00,
            ELE0_TO_1 = 0b01,
            ELE_0_TO_3 = 0b10,
            ELE_0_TO_11 = 0b11,
        }

        export enum Touch {
            DISABLED = 0b0000,
            ELE_0 = 0b0001,
            ELE_0_TO_1 = 0b0010,
            ELE_0_TO_2 = 0b0011,
            ELE_0_TO_3 = 0b0100,
            ELE_0_TO_4 = 0b0101,
            ELE_0_TO_5 = 0b0110,
            ELE_0_TO_6 = 0b0111,
            ELE_0_TO_7 = 0b1000,
            ELE_0_TO_8 = 0b1001,
            ELE_0_TO_9 = 0b1010,
            ELE_0_TO_10 = 0b1011,
            ELE_0_TO_11 = 0b1100,
        }

        export enum Config {
            MHDR = 0x2b,
            NHDR = 0x2c,
            NCLR = 0x2d,
            FDLR = 0x2e,
            MHDF = 0x2f,
            NHDF = 0x30,
            NCLF = 0x31,
            FDLF = 0x32,
            NHDT = 0x33,
            NCLT = 0x34,
            FDLT = 0x35,
            MHDPROXR = 0x36,
            NHDPROXR = 0x37,
            NCLPROXR = 0x38,
            FDLPROXR = 0x39,
            MHDPROXF = 0x3a,
            NHDPROXF = 0x3b,
            NCLPROXF = 0x3c,
            FDLPROXF = 0x3d,
            NHDPROXT = 0x3e,
            NCLPROXT = 0x3f,
            FDLPROXT = 0x40,
            E0TTH = 0x41,
            E0RTH = 0x42,
            E1TTH = 0x43,
            E1RTH = 0x44,
            E2TTH = 0x45,
            E2RTH = 0x46,
            E3TTH = 0x47,
            E3RTH = 0x48,
            E4TTH = 0x49,
            E4RTH = 0x4a,
            E5TTH = 0x4b,
            E5RTH = 0x4c,
            E6TTH = 0x4d,
            E6RTH = 0x4e,
            E7TTH = 0x4f,
            E7RTH = 0x50,
            E8TTH = 0x51,
            E8RTH = 0x52,
            E9TTH = 0x53,
            E9RTH = 0x54,
            E10TTH = 0x55,
            E10RTH = 0x56,
            E11TTH = 0x57,
            E11RTH = 0x58,
            E12TTH = 0x59,
            E12RTH = 0x5a,
            DTR = 0x5b,
            AFE1 = 0x5c,
            AFE2 = 0x5d,
            ECR = 0x5e,
            CDC0 = 0x5f,
            CDC1 = 0x60,
            CDC2 = 0x62,
            CDC4 = 0x63,
            CDC5 = 0x64,
            CDC6 = 0x65,
            CDC7 = 0x66,
            CDC8 = 0x67,
            CDC9 = 0x68,
            CDC10 = 0x69,
            CDC11 = 0x6a,
            CDC12 = 0x6b,
            CDT_0_1 = 0x6c,
            CDT_2_3 = 0x6d,
            CDT_4_5 = 0x6e,
            CDT_6_7 = 0x6f,
            CDT_8_9 = 0x70,
            CDT_10_11 = 0x71,
            CDT_12 = 0x72,
            GPIO_CTL0 = 0x73,
            GPIO_CTL1 = 0x74,
            GPIO_DIR = 0x76,
            GPIO_EN = 0x77,
            GPIO_SET = 0x78,
            GPIO_CLR = 0x79,
            GPIO_TOG = 0x7a,
            AUTO_CONFIG_0 = 0x7b,
            AUTO_CONFIG_1 = 0x7c,
            AUTO_CONFIG_USL = 0x7d,
            AUTO_CONFIG_LSL = 0x7e,
            AUTO_CONFIG_TL = 0x7f,
        }

        let commandDataBuffer: Buffer
        let commandBuffer: Buffer

        function writeCommandData(address: number, command: number, data: number) {
            if (!commandDataBuffer) {
                commandDataBuffer = pins.createBuffer(pins.sizeOf(NumberFormat.UInt16BE))
            }

            commandDataBuffer.setNumber(NumberFormat.UInt16BE, 0, (command << 8) | data)
            pins.i2cWriteBuffer(address, commandDataBuffer)
        }

        function writeCommand(address: number, command: number) {
            if (!commandBuffer) {
                commandBuffer = pins.createBuffer(pins.sizeOf(NumberFormat.UInt8BE))
            }

            commandBuffer.setNumber(NumberFormat.UInt8BE, 0, command)
            pins.i2cWriteBuffer(address, commandBuffer)
        }

        export function configure(address: number, register: Config, value: number) {
            writeCommandData(address, register, value)
        }

        export function configureThresholds(address: number, touch: number, release: number) {
            for (let electrode = 0; electrode < 12; electrode++) {
                configure(address, Config.E0TTH + electrode * 2, touch)
                configure(address, Config.E0RTH + electrode * 2, release)
            }
        }

        export function reset(address: number) {
            writeCommandData(address, 0x80, 0x63)
            basic.pause(30)
        }

        export function stop(address: number) {
            writeCommandData(address, Config.ECR, 0x0)
        }

        export function start(address: number, calibrationLock: CalibrationLock, proximity: Proximity, touch: Touch) {
            writeCommandData(address, Config.ECR, (calibrationLock << 6) | (proximity << 4) | touch)
        }

        export function readTouchStatus(address: number): number {
            writeCommand(address, 0x0)
            return pins.i2cReadNumber(address, NumberFormat.UInt16LE)
        }
    }

    registerSimx()
    initializeSmarthome()
}

// Rangefinder code adapted from pxt-range-vl53l0x
// Source: https://github.com/tinkertanker/pxt-range-vl53l0x
// License: MIT
// Copyright (c) tinkertanker and contributors
namespace Rangefinder {
    let i2cAddr = 0x29
    let IO_TIMEOUT = 1000
    let SYSRANGE_START = 0x00
    let EXTSUP_HV = 0x89
    let MSRC_CONFIG = 0x60
    let FINAL_RATE_RTN_LIMIT = 0x44
    let SYSTEM_SEQUENCE = 0x01
    let SPAD_REF_START = 0x4f
    let SPAD_ENABLES = 0xb0
    let REF_EN_START_SELECT = 0xb6
    let SPAD_NUM_REQUESTED = 0x4e
    let INTERRUPT_GPIO = 0x0a
    let INTERRUPT_CLEAR = 0x0b
    let GPIO_MUX_ACTIVE_HIGH = 0x84
    let RESULT_INTERRUPT_STATUS = 0x13
    let RESULT_RANGE_STATUS = 0x14
    let OSC_CALIBRATE = 0xf8
    let MEASURE_PERIOD = 0x04

    let started = false
    let initialized = false
    let stopVariable = 0
    let spadCount = 0
    let isAperture = false
    let spadMap: number[] = [0, 0, 0, 0, 0, 0]

    function readReg(registerAddress: number): number {
        pins.i2cWriteNumber(i2cAddr, registerAddress, NumberFormat.UInt8BE, false)
        return pins.i2cReadNumber(i2cAddr, NumberFormat.UInt8BE, false)
    }

    function readReg16(registerAddress: number): number {
        pins.i2cWriteNumber(i2cAddr, registerAddress, NumberFormat.UInt8BE, false)
        return pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16BE, false)
    }

    function writeReg(registerAddress: number, data: number): void {
        pins.i2cWriteNumber(i2cAddr, (registerAddress << 8) + data, NumberFormat.UInt16BE, false)
    }

    function writeReg16(registerAddress: number, data: number): void {
        pins.i2cWriteNumber(i2cAddr, registerAddress, NumberFormat.UInt8BE, false)
        pins.i2cWriteNumber(i2cAddr, data, NumberFormat.UInt16BE, false)
    }

    function readFlag(registerAddress: number = 0x00, bit: number = 0): number {
        const data = readReg(registerAddress)
        const mask = 1 << bit
        return data & mask
    }

    function writeFlag(registerAddress: number = 0x00, bit: number = 0, onFlag: boolean): void {
        let data = readReg(registerAddress)
        const mask = 1 << bit
        if (onFlag) {
            data |= mask
        } else {
            data &= ~mask
        }

        writeReg(registerAddress, data)
    }

    /**
     * Initialises the rangefinder.
     */
    export function init(): boolean {
        initialized = false

        const registerC0 = readReg(0xc0)
        const registerC1 = readReg(0xc1)
        const registerC2 = readReg(0xc2)

        if (registerC0 != 0xee || registerC1 != 0xaa || registerC2 != 0x10) {
            return false
        }

        const power2v8 = true
        writeFlag(EXTSUP_HV, 0, power2v8)

        writeReg(0x88, 0x00)
        writeReg(0x80, 0x01)
        writeReg(0xff, 0x01)
        writeReg(0x00, 0x00)
        stopVariable = readReg(0x91)
        writeReg(0x00, 0x01)
        writeReg(0xff, 0x00)
        writeReg(0x80, 0x00)

        writeFlag(MSRC_CONFIG, 1, true)
        writeFlag(MSRC_CONFIG, 4, true)

        writeReg16(FINAL_RATE_RTN_LIMIT, Math.floor(0.25 * (1 << 7)))
        writeReg(SYSTEM_SEQUENCE, 0xff)

        if (!spadInfo()) {
            return false
        }

        pins.i2cWriteNumber(i2cAddr, SPAD_ENABLES, NumberFormat.UInt8BE, false)
        const spad1 = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16BE, false)
        const spad2 = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16BE, false)
        const spad3 = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16BE, false)
        spadMap[0] = (spad1 >> 8) & 0xff
        spadMap[1] = spad1 & 0xff
        spadMap[2] = (spad2 >> 8) & 0xff
        spadMap[3] = spad2 & 0xff
        spadMap[4] = (spad3 >> 8) & 0xff
        spadMap[5] = spad3 & 0xff

        writeReg(0xff, 0x01)
        writeReg(SPAD_REF_START, 0x00)
        writeReg(SPAD_NUM_REQUESTED, 0x2c)
        writeReg(0xff, 0x00)
        writeReg(REF_EN_START_SELECT, 0xb4)

        let spadsEnabled = 0
        for (let index = 0; index < 48; index++) {
            if ((index < 12 && isAperture) || (spadsEnabled >= spadCount)) {
                spadMap[index >> 3] &= ~(1 << (index >> 2))
            } else if (spadMap[index >> 3] & (1 << (index >> 2))) {
                spadsEnabled += 1
            }
        }

        writeReg(0xff, 0x01)
        writeReg(0x00, 0x00)

        writeReg(0xff, 0x00)
        writeReg(0x09, 0x00)
        writeReg(0x10, 0x00)
        writeReg(0x11, 0x00)
        writeReg(0x24, 0x01)
        writeReg(0x25, 0xff)
        writeReg(0x75, 0x00)

        writeReg(0xff, 0x01)
        writeReg(0x4e, 0x2c)
        writeReg(0x48, 0x00)
        writeReg(0x30, 0x20)

        writeReg(0xff, 0x00)
        writeReg(0x30, 0x09)
        writeReg(0x54, 0x00)
        writeReg(0x31, 0x04)
        writeReg(0x32, 0x03)
        writeReg(0x40, 0x83)
        writeReg(0x46, 0x25)
        writeReg(0x60, 0x00)
        writeReg(0x27, 0x00)
        writeReg(0x50, 0x06)
        writeReg(0x51, 0x00)
        writeReg(0x52, 0x96)
        writeReg(0x56, 0x08)
        writeReg(0x57, 0x30)
        writeReg(0x61, 0x00)
        writeReg(0x62, 0x00)
        writeReg(0x64, 0x00)
        writeReg(0x65, 0x00)
        writeReg(0x66, 0xa0)

        writeReg(0xff, 0x01)
        writeReg(0x22, 0x32)
        writeReg(0x47, 0x14)
        writeReg(0x49, 0xff)
        writeReg(0x4a, 0x00)

        writeReg(0xff, 0x00)
        writeReg(0x7a, 0x0a)
        writeReg(0x7b, 0x00)
        writeReg(0x78, 0x21)

        writeReg(0xff, 0x01)
        writeReg(0x23, 0x34)
        writeReg(0x42, 0x00)
        writeReg(0x44, 0xff)
        writeReg(0x45, 0x26)
        writeReg(0x46, 0x05)
        writeReg(0x40, 0x40)
        writeReg(0x0e, 0x06)
        writeReg(0x20, 0x1a)
        writeReg(0x43, 0x40)

        writeReg(0xff, 0x00)
        writeReg(0x34, 0x03)
        writeReg(0x35, 0x44)

        writeReg(0xff, 0x01)
        writeReg(0x31, 0x04)
        writeReg(0x4b, 0x09)
        writeReg(0x4c, 0x05)
        writeReg(0x4d, 0x04)

        writeReg(0xff, 0x00)
        writeReg(0x44, 0x00)
        writeReg(0x45, 0x20)
        writeReg(0x47, 0x08)
        writeReg(0x48, 0x28)
        writeReg(0x67, 0x00)
        writeReg(0x70, 0x04)
        writeReg(0x71, 0x01)
        writeReg(0x72, 0xfe)
        writeReg(0x76, 0x00)
        writeReg(0x77, 0x00)

        writeReg(0xff, 0x01)
        writeReg(0x0d, 0x01)

        writeReg(0xff, 0x00)
        writeReg(0x80, 0x01)
        writeReg(0x01, 0xf8)

        writeReg(0xff, 0x01)
        writeReg(0x8e, 0x01)
        writeReg(0x00, 0x01)
        writeReg(0xff, 0x00)
        writeReg(0x80, 0x00)

        writeReg(INTERRUPT_GPIO, 0x04)
        writeFlag(GPIO_MUX_ACTIVE_HIGH, 4, false)
        writeReg(INTERRUPT_CLEAR, 0x01)

        writeReg(SYSTEM_SEQUENCE, 0x01)
        if (!calibrate(0x40)) {
            return false
        }

        writeReg(SYSTEM_SEQUENCE, 0x02)
        if (!calibrate(0x00)) {
            return false
        }

        writeReg(SYSTEM_SEQUENCE, 0xe8)
        initialized = true
        return true
    }

    function spadInfo(): boolean {
        writeReg(0x80, 0x01)
        writeReg(0xff, 0x01)
        writeReg(0x00, 0x00)
        writeReg(0xff, 0x06)
        writeFlag(0x83, 3, true)
        writeReg(0xff, 0x07)
        writeReg(0x81, 0x01)
        writeReg(0x80, 0x01)
        writeReg(0x94, 0x6b)
        writeReg(0x83, 0x00)

        let timeout = 0
        while (readReg(0x83) == 0) {
            timeout += 1
            basic.pause(1)
            if (timeout == IO_TIMEOUT) {
                return false
            }
        }

        writeReg(0x83, 0x01)
        const value = readReg(0x92)
        writeReg(0x81, 0x00)
        writeReg(0xff, 0x06)
        writeFlag(0x83, 3, false)
        writeReg(0xff, 0x01)
        writeReg(0x00, 0x01)
        writeReg(0xff, 0x00)
        writeReg(0x80, 0x00)

        spadCount = value & 0x7f
        isAperture = (value & 0b10000000) == 0b10000000
        return true
    }

    function calibrate(value: number): boolean {
        writeReg(SYSRANGE_START, 0x01 | value)
        let timeout = 0
        while ((readReg(RESULT_INTERRUPT_STATUS) & 0x07) == 0) {
            timeout += 1
            basic.pause(1)
            if (timeout == IO_TIMEOUT) {
                return false
            }
        }

        writeReg(INTERRUPT_CLEAR, 0x01)
        writeReg(SYSRANGE_START, 0x00)
        return true
    }

    function startContinuous(period: number = 0): void {
        writeReg(0x80, 0x01)
        writeReg(0xff, 0x01)
        writeReg(0x00, 0x00)
        writeReg(0x91, stopVariable)
        writeReg(0x00, 0x01)
        writeReg(0xff, 0x00)
        writeReg(0x80, 0x00)

        let oscillator = 0
        if (period) {
            oscillator = readReg16(OSC_CALIBRATE)
        }

        if (oscillator) {
            period *= oscillator
            writeReg16(MEASURE_PERIOD, (period >> 16) & 0xffff)
            pins.i2cWriteNumber(i2cAddr, period & 0xffff, NumberFormat.UInt16BE, false)
            writeReg(SYSRANGE_START, 0x04)
        } else {
            writeReg(SYSRANGE_START, 0x02)
        }

        started = true
    }

    function stopContinuous(): void {
        writeReg(SYSRANGE_START, 0x01)
        writeReg(0xff, 0x01)
        writeReg(0x00, 0x00)
        writeReg(0x91, stopVariable)
        writeReg(0x00, 0x01)
        writeReg(0xff, 0x00)
        started = false
    }

    function readContinuousDistance(): number {
        let timeout = 0
        while ((readReg(RESULT_INTERRUPT_STATUS) & 0x07) == 0) {
            timeout += 1
            basic.pause(1)
            if (timeout == IO_TIMEOUT) {
                return 0
            }
        }

        const value = readReg16(RESULT_RANGE_STATUS + 10)
        writeReg(INTERRUPT_CLEAR, 0x01)
        return value
    }

    /**
     * Returns the distance detected by the rangefinder (in mm).
     */
    export function distance(): number {
        if (!initialized) {
            return 0
        }

        let timeout = 0
        if (!started) {
            writeReg(0x80, 0x01)
            writeReg(0xff, 0x01)
            writeReg(0x00, 0x00)
            writeReg(0x91, stopVariable)
            writeReg(0x00, 0x01)
            writeReg(0xff, 0x00)
            writeReg(0x80, 0x00)
            writeReg(SYSRANGE_START, 0x01)

            while (readReg(SYSRANGE_START) & 0x01) {
                timeout += 1
                basic.pause(1)
                if (timeout == IO_TIMEOUT) {
                    return 0
                }
            }
        }

        timeout = 0
        while ((readReg(RESULT_INTERRUPT_STATUS) & 0x07) == 0) {
            timeout += 1
            basic.pause(1)
            if (timeout == IO_TIMEOUT) {
                return 0
            }
        }

        const value = readReg16(RESULT_RANGE_STATUS + 10)
        writeReg(INTERRUPT_CLEAR, 0x01)
        return value
    }
}
