import express from "express";
import ytdl from "@distube/ytdl-core";
const router = express.Router();
async function getAudioBuffer(url) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let streamStarted = false;
        // Add timeout
        const timeout = setTimeout(() => {
            if (!streamStarted) {
                reject(new Error("ytdl stream timeout - no data received"));
            }
        }, 15000); // 15 seconds timeout
        const audioStream = ytdl(url, {
            filter: "audioonly",
            quality: "highestaudio",
            requestOptions: {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                },
            },
        });
        audioStream
            .on("data", (chunk) => {
            if (!streamStarted) {
                streamStarted = true;
                clearTimeout(timeout);
                console.log("ytdl stream started, first chunk received");
            }
            chunks.push(chunk);
        })
            .on("end", () => {
            clearTimeout(timeout);
            console.log(`ytdl stream ended, total chunks: ${chunks.length}`);
            resolve(Buffer.concat(chunks));
        })
            .on("error", (err) => {
            clearTimeout(timeout);
            console.error("ytdl stream error:", err);
            reject(err);
        });
    });
}
async function downloadYouTubeAudio(req, res) {
    try {
        const url = req.params.url;
        // Validate URL parameter
        if (!url || typeof url !== "string") {
            res.status(400).json({
                success: false,
                error: "URL parameter is required",
            });
        }
        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
            res.status(400).json({
                success: false,
                error: "Invalid YouTube URL",
            });
        }
        console.log(`Starting audio download for: ${url}`);
        // Get audio buffer
        const audioBuffer = await getAudioBuffer(url);
        // Get video info for filename
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s-]/gi, "").trim();
        // Set appropriate headers
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", `attachment; filename="${title}.mp3"`);
        res.setHeader("Content-Length", audioBuffer.length.toString());
        // Send the audio buffer
        res.send(audioBuffer);
    }
    catch (error) {
        console.error("Error downloading YouTube audio:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
}
// Route: GET /download-youtube-audio?url=https://youtube.com/watch?v=...
router.get("/get-mp3-buffer/:url", downloadYouTubeAudio);
export default router;
