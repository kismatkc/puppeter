import express, { Request, Response } from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const router = express.Router();

async function getTtcAlerts(req: Request, res: Response) {
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
    res.status(200).json({ error });
  }
}

router.get("/scrape", getTtcAlerts);
export default router;
