function parseShifts(shiftsData) {
  if (!shiftsData.success) {
    return { success: false, formattedShifts: {} };
  }

  const formattedShifts = {};

  shiftsData.data.groups.forEach((dateGroup) => {
    const jsDate = new Date(dateGroup.date);
    const formattedDate = `${jsDate.getFullYear()} ${jsDate.toLocaleString(
      "default",
      { month: "long" }
    )} ${jsDate.getDate()} ${jsDate.toLocaleString("default", {
      weekday: "long",
    })}`;

    formattedShifts[formattedDate] = dateGroup.shifts.map((shift) => ({
      id: shift.id,
      title: shift.title,
      note: shift.note || "No note provided",
      site: {
        description: shift.site.description,
        address: shift.site.address,
      },
      startTime: new Date(shift.start_timestamp).toLocaleString(),
      endTime: new Date(shift.end_timestamp).toLocaleString(),
      duration: calculateDuration(shift.start_timestamp, shift.end_timestamp),
      annotation: shift.other?.annotation || "No annotation provided",
    }));
  });

  return {
    success: true,
    formattedShifts,
    timestamp: shiftsData.timestamp,
  };
}

function calculateDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end - start;
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function displayShifts(parsedData) {
  if (!parsedData.success) {
    console.log("No shifts available or error in data");
    return;
  }

  console.log(
    `\n=== AVAILABLE SHIFTS (as of ${new Date(
      parsedData.timestamp
    ).toLocaleString()}) ===\n`
  );

  Object.keys(parsedData.formattedShifts).forEach((date) => {
    console.log(`\n=== ${date} ===`);
    const shifts = parsedData.formattedShifts[date];
    if (shifts.length === 0) {
      console.log("  No shifts available for this date");
      return;
    }
    shifts.forEach((shift, index) => {
      console.log(`\n  SHIFT #${index + 1}: ${shift.title}`);
      console.log(`  Location: ${shift.site.description}`);
      console.log(`  Address: ${shift.site.address}`);
      console.log(
        `  Time: ${shift.startTime} to ${shift.endTime} (${shift.duration})`
      );
      console.log(`  Note: ${shift.note}`);
      console.log(`  Details: ${shift.annotation}`);
    });
  });
}

function processShifts(shiftsData) {
  const parsedData = parseShifts(shiftsData);
  displayShifts(parsedData);
  return parsedData;
}

export { parseShifts, displayShifts, processShifts };

import { chromium } from "playwright";
import axios from "axios";
import fs from "fs";

// Array of realistic user agents to rotate through
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/112.0.1722.39 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15",
];

// Get a random user agent from the list
function getRandomUserAgent() {
  const randomIndex = Math.floor(Math.random() * userAgents.length);
  return userAgents[randomIndex];
}

/**
 * Authenticate with Garda system and extract the SOAP request data
 */
async function authenticateAndCaptureSoapData(headless = false) {
  let browser;
  let extractedData = {
    token: null,
    startDate: null,
    endDate: null,
    cookie: null,
  };

  try {
    console.log("Starting browser authentication process...");
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      userAgent: getRandomUserAgent(),
    });
    const page = await context.newPage();

    // Navigate to the login page
    await page.goto("https://kiosk.ss.garda.com/", {
      waitUntil: "networkidle",
    });

    // Perform login sequence
    console.log("Performing login sequence...");
    await page.locator("#user").fill("kismat.kc@gardaworld.me");
    await page.click("#btn-next-container button");
    await page.locator("#i0116").fill("kismat.kc@gardaworld.me");
    await page.click("#idSIButton9");
    await page.locator("#i0118").fill("Shova@321");
    await page.click("#idSIButton9");
    await page.click("#idSubmit_ProofUp_Redirect");
    await page.click("#id__5");
    await page.getByRole("button", { name: "Skip setup" }).click();

    // Create a promise to capture the token and dates from requests
    const soapDataPromise = new Promise((resolve) => {
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          request.url().endsWith("/api") &&
          request.headers()["soapaction"] === "get_available_shifts"
        ) {
          const postData = request.postData();
          console.log("Captured SOAP request body:", postData);

          // Extract token
          const tokenMatch = postData.match(/<token>(.*?)<\/token>/);
          if (tokenMatch) {
            extractedData.token = tokenMatch[1];
            console.log("Extracted token:", extractedData.token);
          }

          // Extract start date
          const startDateMatch = postData.match(
            /<start_date>(.*?)<\/start_date>/
          );
          if (startDateMatch) {
            extractedData.startDate = startDateMatch[1];
            console.log("Extracted start date:", extractedData.startDate);
          }

          // Extract end date
          const endDateMatch = postData.match(/<end_date>(.*?)<\/end_date>/);
          if (endDateMatch) {
            extractedData.endDate = endDateMatch[1];
            console.log("Extracted end date:", extractedData.endDate);
          }

          resolve(extractedData);
        }
      });
    });

    // Trigger API calls that will contain the SOAP body
    console.log("Triggering API calls to capture SOAP data...");
    await page.click("#idBtn_Back");

    // Wait to capture the SOAP data with a timeout
    await Promise.race([
      soapDataPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SOAP data capture timeout")), 10000)
      ),
    ]);

    // Retrieve session cookies
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      (cookie) =>
        cookie.name === "1752a9b760faa871cf314db0b5c64f22" ||
        cookie.name === "250148a74684b1994637e7497a026aec"
    );

    if (sessionCookie) {
      extractedData.cookie = `${sessionCookie.name}=${sessionCookie.value}; statusSession=true`;
      console.log("Captured cookie:", extractedData.cookie);
    } else {
      console.log("Required cookie not found.");
    }

    return extractedData;
  } catch (error) {
    console.error("Error authenticating:", error);
    throw error;
  } finally {
    // Ensure browser is closed if still open
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Fetch shifts using the template SOAP body and extracted values
 */
async function fetchShifts(extractedData) {
  try {
    console.log("Fetching shifts with template SOAP data...");

    // Use the template and replace the values
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
      <soap:Body>
          <get_available_shifts>
              <token>${extractedData.token}</token>
              <group_by>date</group_by>
              <response_history>[&quot;null&quot;,&quot;interested&quot;,&quot;not_interested&quot;]</response_history>
              <start_date>${extractedData.startDate}</start_date>
              <end_date>${extractedData.endDate}</end_date>
          </get_available_shifts>
      </soap:Body>
  </soap:Envelope>`;

    // Make the API call using the template SOAP body with replaced values
    const response = await axios({
      method: "post",
      url: "https://kiosk.ss.garda.com/api",
      headers: {
        "Content-Type": "text/xml; charset=UTF-8",
        SOAPAction: "get_available_shifts",
        Cookie: extractedData.cookie,
        "User-Agent": getRandomUserAgent(),
      },
      data: soapBody,
    });

    // Process the XML response
    const xmlData = response.data;
    console.log("Successfully fetched shift data!");

    // Extract JSON from XML
    const jsonStart = xmlData.indexOf("{");
    const jsonEnd = xmlData.lastIndexOf("}") + 1;
    if (jsonStart > 0 && jsonEnd > jsonStart) {
      const jsonData = xmlData.substring(jsonStart, jsonEnd);
      const shifts = JSON.parse(jsonData);

      // Save for reference
      fs.writeFileSync("shifts.json", JSON.stringify(shifts, null, 2));
      return shifts;
    } else {
      console.error("Could not extract JSON data from response");
      fs.writeFileSync("raw-response.xml", xmlData);
      return null;
    }
  } catch (error) {
    console.error("Error fetching shifts:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}

/**
 * Main function that handles the entire process
 */
async function getGardaShifts(headless = false) {
  try {
    // Step 1: Authenticate and capture the token and dates
    const capturedData = await authenticateAndCaptureSoapData(headless);

    if (!capturedData.token || !capturedData.cookie) {
      throw new Error("Failed to capture required authentication data");
    }

    // Step 2: Use the template with extracted values to fetch shifts
    const shifts = await fetchShifts(capturedData);
    return shifts;
  } catch (error) {
    console.error("Error in getGardaShifts:", error);
    throw error;
  }
}

// Example usage
async function main() {
  try {
    const shifts = await getGardaShifts(false); // false to see the browser, true for headless

    if (shifts) {
      console.log("Shifts successfully retrieved!");
      console.log(`Total shifts found: ${Object.keys(shifts).length}`);
    }
  } catch (err) {
    console.error("Failed to retrieve shifts:", err);
  }
}

import data from "./test.js";
console.log(JSON.stringify(parseShifts(data), null, 2));

// main()
//   .then(() => console.log("Process completed successfully"))
//   .catch((err) => console.error("Error in main function:", err))
//   .finally(() => process.exit(0));

// Uncomment to run immediately
// main();

// export { getGardaShifts, authenticateAndCaptureSoapData, fetchShifts };
