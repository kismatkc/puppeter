import puppeteer from "puppeteer-core";

async function visualBrowsing(url, actions) {
  // Launch browser with visible window (headless: false)
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null, // Uses full window size
    args: ["--start-maximized"], // Maximize window
  });

  try {
    const page = await browser.newPage();

    // Navigate to specified URL
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "networkidle2" });

    // Execute custom actions if provided
    if (actions && typeof actions === "function") {
      console.log("Performing custom actions...");
      await actions(page);
    }

    // Keep browser open until manually closed
    console.log("Browser is open. Press Ctrl+C in terminal to close.");
  } catch (error) {
    console.error("An error occurred:", error);
    await browser.close();
  }
}

// Example usage
// Replace 'https://example.com' with your target website
visualBrowsing("https://example.com", async (page) => {
  // Example actions - customize as needed
  await page.waitForTimeout(2000); // Wait 2 seconds

  // Find and click a button
  // const button = await page.$('button.some-class');
  // if (button) await button.click();

  // Type into an input field
  // await page.type('input[name="search"]', 'puppeteer automation');

  // Screenshot (optional)
  // await page.screenshot({ path: 'screenshot.png' });

  console.log("Actions completed!");
});
