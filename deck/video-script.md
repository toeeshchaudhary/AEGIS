# AEGIS — Vision Venture explanation video

**Target: 2–3 minutes.** Spoken word count ≈ 380 (natural pace ≈ 150 wpm → ~2:30).
Format below: **[VISUAL]** = what's on screen · **VO** = voiceover.

Recording kit: screen-record the deck (`deck/index.html`, arrow keys) + the live
dashboard (`localhost:3004`, press ▶ Start live sim) + one phone/camera clip of the
breadboard node. Narrate over it. Keep energy up; hit the **bold** words.

---

### 0:00 — Hook  (~15s)
**[VISUAL]** Deck slide 1 (AEGIS cover).
> **VO:** "Nearly **80% of India's fresh water** goes to farming — and a huge share of it is simply **wasted**, poured onto fields that didn't need it. Meanwhile a single frost or field fire can wipe out a season. This is **AEGIS**."

### 0:15 — The problem  (~25s)
**[VISUAL]** Slide 2 (stats), then slide 3 (the gap).
> **VO:** "Small farmers water on a **fixed schedule**, not on need, and get **no early warning** when conditions turn. The smart-farming kits that could help cost **lakhs**, can't be repaired, and need a smartphone and an app. They're built for big commercial farms — not for a two-acre holding."

### 0:40 — The idea  (~25s)
**[VISUAL]** Slide 4 (cream "the idea" slide), then slide 5 (architecture).
> **VO:** "AEGIS flips that. We put a **cheap, repairable sensor node** in the field, and keep the **intelligence in the cloud**. The node measures **soil moisture, temperature, humidity, and smoke** — then sends it over Wi-Fi. The cloud decides what's happening and replies with advice — on the node's screen, a live dashboard, and an **SMS that works on any basic phone**."

### 1:05 — How the brain works  (~25s)
**[VISUAL]** Slide 7 (JSON in → JSON out). Point at the two blocks.
> **VO:** "Here's the clever part. A fast **rule engine** turns raw numbers into an instant status and a **risk score** — in milliseconds. Then AI just **rephrases** it into plain language a farmer can act on. Because the rules run first, AEGIS keeps working and stays **safe even if the AI — or the whole internet — goes down**."

### 1:30 — Live demo  (~35s)  ← the money shot
**[VISUAL]** Switch to the **live dashboard**. Press ▶ Start live sim. Then click **Dry soil**, then **🔥 Fire**.
> **VO:** "And it's **real** — not a mockup. This is our working ESP32 node feeding a live cloud dashboard. Watch the soil dry out… risk climbs… and AEGIS says **'irrigate now — but don't over-water.'** Now if smoke spikes —" *(click Fire)* "— it instantly flags a **fire risk** at 100%, logs the alert, and would fire an SMS. Every reading is stored, so you get **trends and history** too."

### 2:05 — Impact & why it wins  (~25s)
**[VISUAL]** Slide 8 (impact), then slide 9 (differentiators), flash slide 10 (₹850 BOM).
> **VO:** "The impact is direct: **less water**, because you irrigate on need. **Less crop loss**, from early frost, heat, and fire warnings. And **less e-waste** — every sensor is a replaceable module, not a throwaway device. A full node costs about **₹850**. It's roughly a **hundredth** the price of commercial kits, works offline, and reaches **any phone**."

### 2:30 — Close  (~10s)
**[VISUAL]** Slide 12 (Watch the field. Save the water.).
> **VO:** "AEGIS — **protection any farmer can afford, repair, and understand**. Watch the field. Save the water. Thank you."

---

## Shot checklist
- [ ] Deck exported / open full-screen (hide the bottom hint bar — it's `@media print`-hidden in the PDF).
- [ ] Dashboard seeded and **Start live sim** running before you hit record.
- [ ] One clean 5–10s clip of the physical breadboard (LCD showing a status).
- [ ] Optional: overlay the SMS mock-up when you say "fire an SMS".
- [ ] Keep total **under 3:00** (Vision Venture limit is 2–3 min).
