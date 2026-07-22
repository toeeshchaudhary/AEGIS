/*
 * AEGIS — Agri-Tech Sensor Node (Techathon 3.0 / Vision Venture)
 * -------------------------------------------------------------------
 * Theme: Agri-Tech for Sustainable Farming.
 *
 * A low-cost, modular field node built on an ESP32. It reads soil
 * moisture, air temperature and humidity, and a gas/smoke sensor,
 * then:
 *   1. Computes an INSTANT local status (works even with no internet)
 *      so a farmer always sees something useful on the LCD.
 *   2. POSTs the raw readings as JSON to the AEGIS cloud backend over
 *      Wi-Fi. The backend runs the rule engine + AI advice and replies
 *      with a status, a risk score, and a short human-friendly message.
 *   3. Shows the cloud reply on the LCD (falls back to the local status
 *      if the network is down).
 *
 * DESIGN PRINCIPLE: the ESP32 stays "dumb". All heavy intelligence
 * (history, AI explanations, SMS) lives in the cloud. That keeps the
 * node cheap, replaceable and sustainable — the whole AEGIS pitch.
 *
 * Hardware (breadboard, powered 5V via VIN):
 *   DHT11  data -> GPIO 4
 *   MQ-2   AO   -> GPIO 34   (ADC, input-only)
 *   Soil   AO   -> GPIO 35   (ADC, input-only)
 *   16x2 I2C LCD -> SDA GPIO 21, SCL GPIO 22 (addr 0x27)
 *   (optional) Buzzer -> GPIO 18, Green LED -> GPIO 19, Red LED -> GPIO 23
 *
 * !! ADC SAFETY: the MQ-2 / soil analog outputs can approach 5V when the
 *    modules are powered from 5V, but ESP32 ADC pins tolerate max 3.3V.
 *    Use a voltage divider (e.g. 2x 10k) on each AO line, or power the
 *    soil probe from 3V3. See the wiring notes in /docs.
 *
 * Libraries (Arduino Library Manager):
 *   - DHT sensor library (Adafruit)
 *   - LiquidCrystal_I2C
 *   - ArduinoJson (v6+)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

// ---------------------------------------------------------------------------
// Configuration — edit these for your setup
// ---------------------------------------------------------------------------
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// AEGIS cloud ingest endpoint. For a local demo, run the dashboard with
// `pnpm dev` and point this at your PC's LAN IP, e.g. http://192.168.1.50:3000
#define AEGIS_INGEST_URL "http://YOUR_PC_LAN_IP:3000/api/ingest"

// Unique id for this field node (lets one dashboard track many nodes).
#define NODE_ID "field-a"

// Pins
#define DHT_PIN    4
#define DHT_TYPE   DHT11
#define MQ2_PIN    34
#define SOIL_PIN   35
#define BUZZER_PIN 18   // optional
#define GREEN_LED  19   // optional
#define RED_LED    23   // optional

// Soil calibration (RAW ADC). Measure your own probe:
//   SOIL_DRY_RAW  = reading in bone-dry air
//   SOIL_WET_RAW  = reading in a glass of water
// We map raw -> 0..100% moisture using these. Defaults assume a typical
// capacitive probe where DRY reads higher than WET.
#define SOIL_DRY_RAW 3200
#define SOIL_WET_RAW 1200

// Local rule-engine thresholds (mirror the cloud rules so offline == online)
#define SOIL_IRRIGATE_BELOW_PCT 30   // below this % -> irrigate
#define SMOKE_ALERT_ABOVE       2200 // MQ-2 raw -> possible field fire
#define HEAT_STRESS_ABOVE_C     40   // air temp -> heat stress
#define FROST_RISK_BELOW_C      4    // air temp -> frost risk

#define POST_INTERVAL_MS  5000       // send to cloud every 5s
#define LCD_PAGE_MS       3000       // rotate LCD page every 3s

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHT_PIN, DHT_TYPE);

struct Readings {
  float temperature = NAN;
  float humidity    = NAN;
  int   smoke       = 0;
  int   soilRaw     = 0;
  int   soilPct     = 0;
  bool  dhtOk       = false;
};

// Status shown to the farmer. Local status is a safe fallback; cloud status
// (when available) overrides the message with AI-written advice.
String localStatus  = "STARTING";
String cloudStatus  = "";
String cloudMessage = "";
int    cloudRisk    = -1;

Readings latest;
unsigned long lastPost = 0;
unsigned long lastPage = 0;
int  lcdPage = 0;

// ---------------------------------------------------------------------------
// Sensor + logic helpers
// ---------------------------------------------------------------------------
int soilToPercent(int raw) {
  // Higher raw = drier for a typical capacitive probe.
  long pct = map(raw, SOIL_DRY_RAW, SOIL_WET_RAW, 0, 100);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return (int)pct;
}

void readSensors() {
  latest.temperature = dht.readTemperature();
  latest.humidity    = dht.readHumidity();
  latest.dhtOk       = !(isnan(latest.temperature) || isnan(latest.humidity));
  latest.smoke       = analogRead(MQ2_PIN);
  latest.soilRaw     = analogRead(SOIL_PIN);
  latest.soilPct     = soilToPercent(latest.soilRaw);
}

// Instant, offline-safe status. Priority: safety > frost > heat > irrigation.
void computeLocalStatus() {
  if (latest.smoke > SMOKE_ALERT_ABOVE) {
    localStatus = "FIRE RISK";
  } else if (latest.dhtOk && latest.temperature < FROST_RISK_BELOW_C) {
    localStatus = "FROST RISK";
  } else if (latest.dhtOk && latest.temperature > HEAT_STRESS_ABOVE_C) {
    localStatus = "HEAT STRESS";
  } else if (latest.soilPct < SOIL_IRRIGATE_BELOW_PCT) {
    localStatus = "IRRIGATE NOW";
  } else {
    localStatus = "HEALTHY";
  }
}

void driveActuators() {
  bool alarm = (localStatus == "FIRE RISK");
  digitalWrite(GREEN_LED, localStatus == "HEALTHY");
  digitalWrite(RED_LED, alarm);
  if (alarm) tone(BUZZER_PIN, 1000);
  else noTone(BUZZER_PIN);
}

// ---------------------------------------------------------------------------
// LCD — no flicker: we overwrite fixed-width fields, never lcd.clear() in loop
// ---------------------------------------------------------------------------
void printPadded(const String &s) {
  String out = s;
  while (out.length() < 16) out += ' ';
  lcd.print(out.substring(0, 16));
}

void updateLCD() {
  // Effective status: cloud wins if we have one, else local.
  String status = cloudStatus.length() ? cloudStatus : localStatus;

  lcd.setCursor(0, 0);
  switch (lcdPage) {
    case 0: { // Temp / Humidity
      String t = latest.dhtOk ? "T:" + String((int)latest.temperature) + (char)223 + "C" : "T:--";
      String h = latest.dhtOk ? " H:" + String((int)latest.humidity) + "%" : " H:--";
      printPadded(t + h);
      lcd.setCursor(0, 1);
      printPadded("Soil:" + String(latest.soilPct) + "%");
      break;
    }
    case 1: { // Status + risk
      printPadded("AEGIS: " + status);
      lcd.setCursor(0, 1);
      if (cloudRisk >= 0) printPadded("Risk: " + String(cloudRisk) + "%");
      else                printPadded("Soil:" + String(latest.soilPct) + "% Smk:" + String(latest.smoke));
      break;
    }
    case 2: { // Cloud advice (scrolls the message across two lines)
      if (cloudMessage.length()) {
        printPadded(cloudMessage.substring(0, 16));
        lcd.setCursor(0, 1);
        printPadded(cloudMessage.length() > 16 ? cloudMessage.substring(16, 32) : "");
      } else {
        printPadded("AEGIS: " + status);
        lcd.setCursor(0, 1);
        printPadded(WiFi.status() == WL_CONNECTED ? "Cloud: online" : "Cloud: offline");
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lcd.setCursor(0, 1);
  printPadded("WiFi...");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
  }
}

void sendToCloud() {
  if (WiFi.status() != WL_CONNECTED) {
    // Try to reconnect quietly; keep running on local status meanwhile.
    WiFi.reconnect();
    return;
  }

  StaticJsonDocument<256> doc;
  doc["nodeId"]      = NODE_ID;
  doc["temperature"] = latest.dhtOk ? latest.temperature : (float)0;
  doc["humidity"]    = latest.dhtOk ? latest.humidity : (float)0;
  doc["smoke"]       = latest.smoke;
  doc["soilRaw"]     = latest.soilRaw;
  doc["soilPct"]     = latest.soilPct;
  doc["dhtOk"]       = latest.dhtOk;
  doc["localStatus"] = localStatus;

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(AEGIS_INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);

  if (code == 200) {
    String resp = http.getString();
    StaticJsonDocument<384> in;
    if (deserializeJson(in, resp) == DeserializationError::Ok) {
      cloudStatus  = in["status"]  | localStatus;
      cloudRisk    = in["risk"]    | -1;
      cloudMessage = in["message"] | "";
    }
  } else {
    // Network hiccup: drop back to local status until next success.
    cloudStatus = "";
    cloudRisk   = -1;
  }
  http.end();
}

// ---------------------------------------------------------------------------
// Setup / loop
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);

  dht.begin();
  Wire.begin();
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  printPadded("AEGIS Agri Node");

  connectWiFi();
  lcd.clear();
}

void loop() {
  readSensors();
  computeLocalStatus();
  driveActuators();

  unsigned long now = millis();

  if (now - lastPage >= LCD_PAGE_MS) {
    lcdPage = (lcdPage + 1) % 3;
    lastPage = now;
  }
  updateLCD();

  if (now - lastPost >= POST_INTERVAL_MS) {
    sendToCloud();
    lastPost = now;
    // One-line serial log for debugging / the demo video.
    Serial.printf("T:%.1f H:%.1f Smoke:%d Soil:%d%%(%d) | local:%s cloud:%s risk:%d\n",
                  latest.temperature, latest.humidity, latest.smoke,
                  latest.soilPct, latest.soilRaw,
                  localStatus.c_str(),
                  cloudStatus.length() ? cloudStatus.c_str() : "-",
                  cloudRisk);
  }

  delay(200);
}
