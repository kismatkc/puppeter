import express, { json } from "express";
import CORS from "cors";
import getTtcAlerts from "./controllers/ttc-alert.ts";
import getTtcTimes from "./controllers/ttc-times.ts";
import modifyStops from "./controllers/modify-stops.ts";

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

app.use("/", async (req, res) => {
  res.send("Hello world");
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
