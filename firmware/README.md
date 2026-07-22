# AEGIS Agri Node — Firmware

ESP32 field node for the AEGIS Agri-Tech system. Reads soil moisture, air
temp/humidity and gas/smoke; shows an instant local status on the LCD; and
POSTs readings to the AEGIS cloud, displaying the AI advice it gets back.

## Libraries (Arduino IDE → Library Manager)
- **DHT sensor library** (Adafruit) + its dependency *Adafruit Unified Sensor*
- **LiquidCrystal_I2C**
- **ArduinoJson** (v6 or newer)

Board: install **esp32 by Espressif** via Boards Manager, select your DevKit
(e.g. "ESP32 Dev Module").

## Wiring (breadboard, 5V via VIN)
| Component | ESP32 pin |
|---|---|
| DHT11 data | GPIO 4 |
| MQ-2 AO | GPIO 34 |
| Soil AO | GPIO 35 |
| LCD SDA | GPIO 21 |
| LCD SCL | GPIO 22 |
| (opt) Buzzer | GPIO 18 |
| (opt) Green LED | GPIO 19 |
| (opt) Red LED | GPIO 23 |

LCD I²C address is `0x27` (change to `0x3F` in the sketch if your backpack
differs).

⚠️ **ADC safety:** ESP32 ADC pins tolerate **max 3.3V**. MQ-2 and many soil
modules powered at 5V can output up to ~5V on AO. Put a simple 2×10kΩ voltage
divider on each AO line (or power the soil probe from 3V3) to protect GPIO 34/35.

## Before flashing — edit these in `aegis_node/aegis_node.ino`
1. `WIFI_SSID` / `WIFI_PASSWORD`
2. `AEGIS_INGEST_URL` → your PC's LAN IP running the dashboard, e.g.
   `http://192.168.1.50:3000/api/ingest` (find it with `ip addr` / `ipconfig`).
3. `NODE_ID` — a name for this node (default `field-a`).

## Calibrate the soil probe (2 minutes, improves the demo)
1. Flash, open Serial Monitor @ 115200.
2. Hold the probe in **dry air** → note the `Soil:...(RAW)` number → set `SOIL_DRY_RAW`.
3. Dip it in **a glass of water** → note the RAW → set `SOIL_WET_RAW`.
4. Re-flash. Now `Soil %` reads 0 (bone dry) → 100 (soaked).

## Offline behaviour
If Wi-Fi/cloud is down the node keeps working: the LCD shows the **local**
status (IRRIGATE NOW / HEALTHY / FROST RISK / HEAT STRESS / FIRE RISK) computed
on-device. This resilience is a deliberate selling point — a farmer is never
left with a blank screen.
