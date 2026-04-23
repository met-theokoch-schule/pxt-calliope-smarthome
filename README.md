# Smarthome

Diese MakeCode-Erweiterung steuert ein Smarthome-Modell der Theo-Koch-Schule Gruenberg. Sie stellt Bloecke fuer Rolladen, Klimaanlage, Lampen, Wandlampen-LEDs, Touch-Schalter und Praesenzmeldung bereit. Die Erweiterung enthaelt ausserdem eine Simulator-Erweiterung im Ordner `simx`, damit die Zustaende des Modells in MakeCode sichtbar und bedienbar sind.

## Als Erweiterung verwenden

Dieses Repository kann in MakeCode als Erweiterung importiert werden.

- `https://makecode.calliope.cc/` oeffnen
- ein neues Projekt erstellen
- Erweiterungen oeffnen
- nach `https://github.com/met-theokoch-schule/pxt-calliope-smarthome` suchen und importieren

## Dieses Projekt bearbeiten

Zum Bearbeiten kann das Repository direkt in MakeCode importiert werden.

- `https://makecode.calliope.cc/` oeffnen
- Importieren auswaehlen
- GitHub-URL `https://github.com/met-theokoch-schule/pxt-calliope-smarthome` einfuegen
- Projekt importieren

## Blocks Preview

Die Blocks-Vorschau wird auf GitHub Pages durch den MakeCode-Renderer am Ende dieser README erzeugt. Nach neuen Commits kann die Aktualisierung einige Minuten dauern.

## Hardware

Die Erweiterung ist fuer den Calliope mini mit dem Smarthome-Modell ausgelegt.

- Rolladen: Servo an `C16`
- Klimaanlage: Motor `M0`
- Lampen: NeoPixel-Streifen an `C8`
- Wandlampe: NeoPixel 3 bis 10 des Streifens, als LED 1 bis 8 angesprochen
- Schalter `S0` bis `S9`: MPR121-Touchcontroller an I2C-Adresse `0x5a`
- Praesenzsensor: VL53L0X-Rangefinder

## Bloecke

### Rolladen

#### `Rolladen öffnen/schließen`

Oeffnet oder schliesst den Rolladen.

```typescript
smarthome.switchShades(smarthome.ShadeState.Open)
basic.pause(1000)
smarthome.switchShades(smarthome.ShadeState.Close)
```

#### `Rolladen ist offen`

Gibt `true` zurueck, wenn der Rolladen als offen gespeichert ist.

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

Gibt `true` zurueck, wenn die Klimaanlage als eingeschaltet gespeichert ist.

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

Gibt `true` zurueck, wenn die ausgewaehlte Lampe als eingeschaltet gespeichert ist.

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

Setzt eine einzelne Wandlampen-LED auf eine Farbe. Dieser Block liegt unter `Mehr`, weil er als `advanced` markiert ist. Die LED-Nummer ist fuer Variablen und Schleifen gedacht; gueltig sind LED `1` bis `8`. Kleinere oder groessere Werte werden automatisch auf diesen Bereich begrenzt.

```typescript
for (let led = 1; led <= 8; led++) {
    smarthome.setWallLampLedColor(led, 0x0000ff)
    basic.pause(100)
}
```

### Schalter

#### `wenn Schalter ... gedrückt`

Fuehrt Code aus, sobald ein Touch-Schalter `S0` bis `S9` gedrueckt wird. Dieser Block unterscheidet nicht zwischen kurzem und langem Druck.

```typescript
smarthome.onTouchSensorTouched(smarthome.TouchSwitch.S0, function () {
    smarthome.showLampColor(smarthome.LampName.CeilingLamp1, 0xffffff)
})
```

#### `wenn Schalter ... kurz/lang gedrückt`

Fuehrt Code aus, wenn ein Touch-Schalter kurz oder lang gedrueckt wurde. Dieser Block liegt unter `Mehr`, weil er als `advanced` markiert ist. Ein langer Druck wird nach mindestens `750 ms` Halten ausgeloest. Ein kurzer Druck wird beim Loslassen ausgeloest, wenn vorher kein langer Druck erkannt wurde.

```typescript
smarthome.onTouchSensorPressed(smarthome.TouchSwitch.S1, smarthome.TouchPressType.Short, function () {
    smarthome.showLampColor(smarthome.LampName.CeilingLamp2, 0xffff00)
})

smarthome.onTouchSensorPressed(smarthome.TouchSwitch.S1, smarthome.TouchPressType.Long, function () {
    smarthome.switchLampOff(smarthome.LampName.CeilingLamp2)
})
```

### Praesenz

#### `wenn Präsenz gemeldet`

Fuehrt Code aus, wenn der Praesenzsensor eine Bewegung beziehungsweise Annaeherung erkennt. In der Simulation kann die Praesenzmeldung ueber die Praesenz-Schaltflaeche ausgeloest werden.

```typescript
smarthome.onPresenceDetected(function () {
    smarthome.switchAirConditioning(smarthome.PowerState.On)
    smarthome.showLampColor(smarthome.LampName.OutsideLamp, 0xffffff)
})
```

## Simulator

Die Simulator-Erweiterung befindet sich in `simx`. Sie synchronisiert den Zustand der Lampen, Wandlampen-LEDs, des Rolladens und der Klimaanlage mit MakeCode. Die Schalter `S0` bis `S9` und die Praesenzmeldung koennen in der Simulation ausgelöst werden. Die neuen Kurz-/Langdruck-Bloecke arbeiten mit den bestehenden `press`- und `release`-Nachrichten der Simulation.

## Lizenz

MIT

---

#### Metadata (used for search, rendering)

* for PXT/calliopemini
* for PXT/microbit

<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
