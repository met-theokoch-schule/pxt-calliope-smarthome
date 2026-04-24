# Calliope Smarthome

> Hinweis: Below the German documentation you can find an English translation.

![Smarthome](https://github.com/met-theokoch-schule/pxt-calliope-smarthome/raw/master/assets/smarthome.jpg "Smarthome Ansichten")

Diese MakeCode-Erweiterung steuert ein Smarthome-Modell der Theo-Koch-Schule Grünberg. Sie stellt Blöcke für Rolladen, Klimaanlage, Lampen, Wandlampen-LEDs, Touch-Schalter und Präsenzmeldung bereit.

* Bauanleitung: https://theokoch.schule/dw/smarthome/files/0/Bauanleitung-DW-Calliope-Smarthome.pdf
* 3D-Dateien und Unterrichtsideen: https://theokoch.schule/dw/smarthome

## Als Erweiterung verwenden

Dieses Repository kann in MakeCode als Erweiterung importiert werden.

- `https://makecode.calliope.cc/` öffnen
- ein neues Projekt erstellen
- Erweiterungen öffnen
- nach `https://github.com/met-theokoch-schule/pxt-calliope-smarthome` suchen und importieren

## Hardware

Die Erweiterung ist für den Calliope mini mit dem Smarthome-Modell ausgelegt. Eine Anleitung zum Bau findet sich unter http://theokoch.schule/dw/smarthome - dort finden sich auch die 3D-Druckdateien und eine Gerber-Datei.

- Rolladen: Servo an `C16`
- Klimaanlage: Motor `M0`
- Lampen: NeoPixel-Streifen an `C8`
- Wandlampe: NeoPixel 3 bis 10 des Streifens, als LED 1 bis 8 angesprochen
- Schalter `S0` bis `S9`: MPR121-Touchcontroller an I2C-Adresse `0x5a`
- Präsenzsensor: VL53L0X-Rangefinder

## Blöcke
![Blöcke](https://github.com/met-theokoch-schule/pxt-calliope-smarthome/raw/master/assets/blocks.jpg "Smarthome Blöcke")

### Rolladen

#### `Rolladen öffnen/schließen`

Öffnet oder schließt den Rolladen.

```typescript
smarthome.switchShades(smarthome.ShadeState.Open)
basic.pause(1000)
smarthome.switchShades(smarthome.ShadeState.Close)
```

#### `Rolladen ist offen`

Gibt `true` zurück, wenn der Rolladen als offen gespeichert ist.

```typescript
if (smarthome.getShadesStatus()) {
    basic.showString("offen")
}
```

### Klimaanlage

#### `schalte die Klimaanlage an/aus`

Schaltet die Klimaanlage ein oder aus. Beim Einschalten wird Motor `M0` mit voller Leistung gestartet.

```typescript
smarthome.switchAirConditioning(smarthome.PowerState.On)
basic.pause(2000)
smarthome.switchAirConditioning(smarthome.PowerState.Off)
```

#### `setze Klimaanlage auf ... %`

Setzt die Motorleistung der Klimaanlage. Werte werden auf den Bereich `25` bis `100` Prozent begrenzt.

```typescript
smarthome.setAirConditioningPower(60)
```

#### `Klimaanlage ist an`

Gibt `true` zurück, wenn die Klimaanlage als eingeschaltet gespeichert ist.

```typescript
if (smarthome.getAirConditioningStatus()) {
    basic.showIcon(IconNames.Yes)
}
```

### Lampen

#### `setze ... auf ...`

Setzt eine einzelne Lampe auf eine Farbe. Bei der Wandlampe werden alle acht Wandlampen-LEDs auf dieselbe Farbe gesetzt.

```typescript
smarthome.showLampColor(smarthome.LampName.CeilingLamp1, 0xff0000)
smarthome.showLampColor(smarthome.LampName.OutsideLamp, 0x00ff00)
smarthome.showLampColor(smarthome.LampName.WallLamp, 0xffffff)
```

#### `schalte ... aus`

Schaltet eine einzelne Lampe aus. Bei der Wandlampe werden alle acht Wandlampen-LEDs ausgeschaltet.

```typescript
smarthome.switchLampOff(smarthome.LampName.CeilingLamp1)
smarthome.switchLampOff(smarthome.LampName.WallLamp)
```

#### `... ist an`

Gibt `true` zurück, wenn die ausgewählte Lampe als eingeschaltet gespeichert ist.

```typescript
if (smarthome.getLampStatus(smarthome.LampName.OutsideLamp)) {
    basic.showString("A")
}
```

### Wandlampe

#### `setze Wandlampe auf ...`

Setzt die acht Wandlampen-LEDs einzeln. Die Farben entsprechen LED 1 bis LED 8 der Wandlampe.

```typescript
smarthome.showWallLampColorPixel(
    0xff0000,
    0xff8000,
    0xffff00,
    0x00ff00,
    0x00ffff,
    0x0000ff,
    0xff00ff,
    0xffffff
)
```

#### `setze Wandlampe LED ... auf ...`

Setzt eine einzelne Wandlampen-LED auf eine Farbe. Dieser Block liegt unter `Mehr`, weil er als `advanced` markiert ist. Die LED-Nummer ist für Variablen und Schleifen gedacht; gültig sind LED `1` bis `8`. Kleinere oder größere Werte werden automatisch auf diesen Bereich begrenzt.

```typescript
for (let led = 1; led <= 8; led++) {
    smarthome.setWallLampLedColor(led, 0x0000ff)
    basic.pause(100)
}
```

### Schalter

#### `wenn Schalter ... gedrückt`

Führt Code aus, sobald ein Touch-Schalter `S0` bis `S9` gedrückt wird. Dieser Block unterscheidet nicht zwischen kurzem und langem Druck.

```typescript
smarthome.onTouchSensorTouched(smarthome.TouchSwitch.S0, function () {
    smarthome.showLampColor(smarthome.LampName.CeilingLamp1, 0xffffff)
})
```

#### `wenn Schalter ... kurz/lang gedrückt`

Führt Code aus, wenn ein Touch-Schalter kurz oder lang gedrückt wurde. Dieser Block liegt unter `Mehr`, weil er als `advanced` markiert ist. Ein langer Druck wird nach mindestens `750 ms` Halten ausgelöst. Ein kurzer Druck wird beim Loslassen ausgelöst, wenn vorher kein langer Druck erkannt wurde.

```typescript
smarthome.onTouchSensorPressed(smarthome.TouchSwitch.S1, smarthome.TouchPressType.Short, function () {
    smarthome.showLampColor(smarthome.LampName.CeilingLamp2, 0xffff00)
})

smarthome.onTouchSensorPressed(smarthome.TouchSwitch.S1, smarthome.TouchPressType.Long, function () {
    smarthome.switchLampOff(smarthome.LampName.CeilingLamp2)
})
```

### Präsenz

#### `wenn Präsenz gemeldet`

Führt Code aus, wenn der Präsenzsensor eine Bewegung beziehungsweise Annäherung erkennt. In der Simulation kann die Präsenzmeldung über die Präsenz-Schaltfläche ausgelöst werden.

```typescript
smarthome.onPresenceDetected(function () {
    smarthome.switchAirConditioning(smarthome.PowerState.On)
    smarthome.showLampColor(smarthome.LampName.OutsideLamp, 0xffffff)
})
```

## Simulator

Die Simulator-Erweiterung synchronisiert den Zustand der Lampen, Wandlampen-LEDs, des Rolladens und der Klimaanlage mit MakeCode. Die Schalter `S0` bis `S9` und die Präsenzmeldung können in der Simulation ausgelöst werden. 

## Lizenz

MIT

---

# English Translation

![Smarthome](https://github.com/met-theokoch-schule/pxt-calliope-smarthome/raw/master/assets/smarthome.jpg "Smarthome views")

This MakeCode extension controls a smart home model built by Theo Koch School in Gruenberg, Germany. It provides blocks for shades, air conditioning, lamps, wall lamp LEDs, touch switches, and presence detection.

* Building guide (German only): https://theokoch.schule/dw/smarthome/files/0/Bauanleitung-DW-Calliope-Smarthome.pdf
* 3D files and teaching ideas (German only): https://theokoch.schule/dw/smarthome

## Use As An Extension

This repository can be imported into MakeCode as an extension.

- Open `https://makecode.calliope.cc/`
- Create a new project
- Open Extensions
- Search for `https://github.com/met-theokoch-schule/pxt-calliope-smarthome` and import it

## Hardware

The extension is designed for the Calliope mini together with the smart home model. Building instructions are available in German at http://theokoch.schule/dw/smarthome, where you can also find the 3D printing files and a Gerber file.

- Shades: servo on `C16`
- Air conditioning: motor `M0`
- Lamps: NeoPixel strip on `C8`
- Wall lamp: NeoPixels 3 to 10 on the strip, addressed as LEDs 1 to 8
- Switches `S0` to `S9`: MPR121 touch controller at I2C address `0x5a`
- Presence sensor: VL53L0X rangefinder

## Blocks
![Blocks](https://github.com/met-theokoch-schule/pxt-calliope-smarthome/raw/master/assets/blocks.jpg "Smarthome blocks")

### Shades

#### `open/close shades`

Opens or closes the shades.

```typescript
smarthome.switchShades(smarthome.ShadeState.Open)
basic.pause(1000)
smarthome.switchShades(smarthome.ShadeState.Close)
```

#### `shades are open`

Returns `true` if the shades are stored as open.

```typescript
if (smarthome.getShadesStatus()) {
    basic.showString("open")
}
```

### Air Conditioning

#### `turn air conditioning on/off`

Turns the air conditioning on or off. When switched on, motor `M0` starts at full power.

```typescript
smarthome.switchAirConditioning(smarthome.PowerState.On)
basic.pause(2000)
smarthome.switchAirConditioning(smarthome.PowerState.Off)
```

#### `set air conditioning to ... %`

Sets the motor power for the air conditioning. Values are limited to the range from `25` to `100` percent.

```typescript
smarthome.setAirConditioningPower(60)
```

#### `air conditioning is on`

Returns `true` if the air conditioning is stored as switched on.

```typescript
if (smarthome.getAirConditioningStatus()) {
    basic.showIcon(IconNames.Yes)
}
```

### Lamps

#### `set ... to ...`

Sets a single lamp to a color. For the wall lamp, all eight wall lamp LEDs are set to the same color.

```typescript
smarthome.showLampColor(smarthome.LampName.CeilingLamp1, 0xff0000)
smarthome.showLampColor(smarthome.LampName.OutsideLamp, 0x00ff00)
smarthome.showLampColor(smarthome.LampName.WallLamp, 0xffffff)
```

#### `turn ... off`

Turns a single lamp off. For the wall lamp, all eight wall lamp LEDs are turned off.

```typescript
smarthome.switchLampOff(smarthome.LampName.CeilingLamp1)
smarthome.switchLampOff(smarthome.LampName.WallLamp)
```

#### `... is on`

Returns `true` if the selected lamp is stored as switched on.

```typescript
if (smarthome.getLampStatus(smarthome.LampName.OutsideLamp)) {
    basic.showString("A")
}
```

### Wall Lamp

#### `set wall lamp to ...`

Sets the eight wall lamp LEDs individually. The colors correspond to LED 1 through LED 8 of the wall lamp.

```typescript
smarthome.showWallLampColorPixel(
    0xff0000,
    0xff8000,
    0xffff00,
    0x00ff00,
    0x00ffff,
    0x0000ff,
    0xff00ff,
    0xffffff
)
```

#### `set wall lamp LED ... to ...`

Sets a single wall lamp LED to a color. This block is under `More` because it is marked as `advanced`. The LED number is intended for variables and loops; valid values are LED `1` to `8`. Smaller or larger values are automatically clamped to this range.

```typescript
for (let led = 1; led <= 8; led++) {
    smarthome.setWallLampLedColor(led, 0x0000ff)
    basic.pause(100)
}
```

### Switches

#### `when switch ... is touched`

Runs code as soon as a touch switch `S0` to `S9` is pressed. This block does not distinguish between short and long presses.

```typescript
smarthome.onTouchSensorTouched(smarthome.TouchSwitch.S0, function () {
    smarthome.showLampColor(smarthome.LampName.CeilingLamp1, 0xffffff)
})
```

#### `when switch ... is pressed shortly/long`

Runs code when a touch switch has been pressed briefly or held down. This block is under `More` because it is marked as `advanced`. A long press is triggered after holding the switch for at least `750 ms`. A short press is triggered on release if no long press was detected before.

```typescript
smarthome.onTouchSensorPressed(smarthome.TouchSwitch.S1, smarthome.TouchPressType.Short, function () {
    smarthome.showLampColor(smarthome.LampName.CeilingLamp2, 0xffff00)
})

smarthome.onTouchSensorPressed(smarthome.TouchSwitch.S1, smarthome.TouchPressType.Long, function () {
    smarthome.switchLampOff(smarthome.LampName.CeilingLamp2)
})
```

### Presence

#### `when presence is detected`

Runs code when the presence sensor detects motion or proximity. In the simulator, the presence event can be triggered using the presence button.

```typescript
smarthome.onPresenceDetected(function () {
    smarthome.switchAirConditioning(smarthome.PowerState.On)
    smarthome.showLampColor(smarthome.LampName.OutsideLamp, 0xffffff)
})
```

## Simulator

The simulator extension synchronizes the state of the lamps, wall lamp LEDs, shades, and air conditioning with MakeCode. The `S0` to `S9` switches and the presence event can be triggered in the simulation.

---

#### Metadata (used for search, rendering)

* for PXT/calliopemini

<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
