import express from "express";
import CORS from "cors";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
const app = express();
app.use(CORS());
const PORT = 4000; // Corrected environment variable
if (!PORT) {
  throw new Error("Please provide a valid port");
}
app.get("/scrape", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.goto("https://www.ttc.ca/service-alerts", {
      waitUntil: "networkidle2",
    });
    const news = await page.waitForSelector("#react-tabs-1 > ul", {
      visible: true,
    });
    const alerts = await news?.evaluate((el) => {
      const liCollection = Array.from(el.querySelectorAll("li")).map((item) =>
        item.textContent?.trim()
      );
      return liCollection;
    });
    res.json({
      data: alerts,
    });
  } catch (error) {
    console.log(error);
  }
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
