import dotenv from "dotenv";
import express, { Request, Response } from "express";
import CORS from "cors";
import puppeteer from "puppeteer";

dotenv.config();

const app = express();
app.use(CORS());
const PORT = process.env.PORT; // Corrected environment variable

if (!PORT) {
  throw new Error("Please provide a valid port");
}

app.get("/scrape", async (req: Request, res: Response) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
