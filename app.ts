import express, { json } from "express";
import CORS from "cors";
import getTtcAlerts from "./controllers/ttc-alert.ts";
import getTtcTimes from "./controllers/ttc-times.ts";
import modifyStops from "./controllers/modify-stops.ts";
import weatherReport from "./controllers/weather-report.ts";
import wordBreakdown from "./controllers/word-breakdown.ts";
import getMp3 from "./controllers/get-mp3.ts";
import streaks from "./controllers/streaks.ts";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(CORS());
app.use(json());
const PORT = 4000; // Corrected environment variable

if (!PORT) {
  throw new Error("Please provide a valid port");
}

app.use("/", getTtcAlerts);
app.use("/", getTtcTimes);
app.use("/", modifyStops);
app.use("/", weatherReport);
app.use("/", wordBreakdown);
app.use("/", getMp3);
app.use("/", streaks);

app.use("/", async (req, res) => {
  res.send("Hello world");
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
