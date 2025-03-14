import express from "express";
import CORS from "cors";
import getTtcAlerts from "./controllers/ttc-alert.ts";

const app = express();
app.use(CORS());
const PORT = 4000; // Corrected environment variable

if (!PORT) {
  throw new Error("Please provide a valid port");
}

app.use("/", getTtcAlerts);

app.use("/", async (req, res) => {
  res.send("Hello world");
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
