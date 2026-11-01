require("dotenv").config();
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.DEVICE_API_KEY;

if (!apiKey) {
  throw new Error("Set the DEVICE_API_KEY environment variable.");
}

app.use(express.json({ limit: "1kb" }));

let latest = null;

app.post("/api/temperature", (req, res) => {
  if (req.get("X-API-Key") !== apiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const temperature = req.body.temperature;

  if (
    typeof temperature !== "number" ||
    !Number.isFinite(temperature) ||
    temperature < -40 ||
    temperature > 80
  ) {
    return res.status(400).json({
      error: "Provide a numeric temperature between -40 and 80 C."
    });
  }

  latest = {
    temperature,
    updatedAt: new Date().toISOString()
  };

  res.json({ ok: true });
});

app.get("/api/temperature", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(latest || {
    temperature: null,
    updatedAt: null
  });
});

app.get("/", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ESP32 Temperature</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #0f172a;
      color: #e2e8f0;
      font-family: system-ui, sans-serif;
    }
    main {
      width: min(85vw, 430px);
      padding: 32px;
      text-align: center;
      background: #1e293b;
      border-radius: 24px;
    }
    h1 { font-size: 24px; }
    #temperature {
      margin: 24px 0;
      font-size: 64px;
      color: #38bdf8;
    }
    #status { color: #fbbf24; }
    #updated { color: #94a3b8; font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <h1>ESP32 Temperature</h1>
    <div id="temperature">-- °C</div>
    <p id="status">Waiting for the first reading…</p>
    <p id="updated">No readings received yet.</p>
  </main>

  <script>
    async function refresh() {
      try {
        const response = await fetch("/api/temperature", {
          cache: "no-store"
        });
        if (!response.ok) throw new Error("Request failed");

        const data = await response.json();

        if (data.temperature === null) {
          document.getElementById("temperature").textContent = "-- °C";
          document.getElementById("status").textContent =
            "Waiting for the ESP32…";
          document.getElementById("updated").textContent =
            "No readings received yet.";
          return;
        }

        document.getElementById("temperature").textContent =
          data.temperature.toFixed(1) + " °C";

        const age = Date.now() - new Date(data.updatedAt).getTime();
        const live = age < 30000;

        const status = document.getElementById("status");
        status.textContent = live
          ? "Live — receiving readings"
          : "Offline — showing last reading";
        status.style.color = live ? "#4ade80" : "#fbbf24";

        document.getElementById("updated").textContent =
          "Last received: " + new Date(data.updatedAt).toLocaleString();
      } catch (error) {
        document.getElementById("status").textContent =
          "Cannot reach the server — retrying…";
      } finally {
        setTimeout(refresh, 3000);
      }
    }

    refresh();
  </script>
</body>
</html>`);
});

app.listen(port, "0.0.0.0", () => {
  console.log("Temperature dashboard listening on port " + port);
});