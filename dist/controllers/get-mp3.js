import express from "express";
import axios from "axios";
import ytdl from "@distube/ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import FormData from "form-data";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Configuration using environment variables with defaults
const appwriteEndpoint = process.env.APPWRITE_URL_STORAGE || "https://fra.cloud.appwrite.io/v1";
const appwriteProjectId = process.env.APPWRITE_PROJECTID_music || "680176d3001131c8a4e7";
const appwriteApiKey = process.env.APPWRITE_API_KEY ||
    "standard_17844b2057d31a53694f426cdeaa3bd048df2a8e9f16f1d0a20ac41aeb231baf1198843cc4538a53296b2af451a12a0bdc78ccb6c78872e1a34265dfa8d44ce3d1b6569375d277c8b0adc81a4de3feedc81492bf6824e49ba82a9c0ab10fd36ac5ac4a8aef525ed125bc8fb21a9aec28b4b86031e8ce7d92c094792bef22958a";
const bucketId = process.env.APPWRITE_MUSIC_BUCKETNAME || "6801777c0003a97d6c14";
// Temporary directory setup
const tempDir = "/tmp/mp3-converter";
// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}
async function getMp3(req, res) {
    let tempFilePath = "";
    try {
        const { url } = req.body;
        // Validate request
        if (!url)
            res.status(400).json({ error: "YouTube URL is required" });
        if (!ytdl.validateURL(url))
            res.status(400).json({ error: "Invalid YouTube URL" });
        // Get video info
        const videoInfo = await ytdl.getInfo(url);
        const videoTitle = videoInfo.videoDetails.title.replace(/[^\w\s]/gi, "");
        const safeFileName = `${videoTitle.substring(0, 50)}`.replace(/\s+/g, "_");
        tempFilePath = path.join(tempDir, `${safeFileName}.mp3`);
        // Download and convert audio to MP3
        const audioStream = ytdl(url, {
            quality: "highestaudio",
            filter: "audioonly",
        });
        await new Promise((resolve, reject) => {
            ffmpeg(audioStream)
                .audioBitrate(192)
                .toFormat("mp3")
                .on("error", reject)
                .on("end", resolve)
                .save(tempFilePath);
        });
        // Verify conversion
        if (!fs.existsSync(tempFilePath)) {
            throw new Error("Conversion failed - no output file");
        }
        // Upload to Appwrite using REST API
        const formData = new FormData();
        const fileStream = fs.createReadStream(tempFilePath);
        const fileName = `${safeFileName}.mp3`;
        formData.append("file", fileStream, fileName);
        formData.append("fileId", "unique()"); // Let Appwrite generate a unique ID
        const response = await axios.post(`${appwriteEndpoint}/storage/buckets/${bucketId}/files`, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
                "X-Appwrite-Project": appwriteProjectId,
                "X-Appwrite-Key": appwriteApiKey,
            },
        });
        const fileId = response.data.$id;
        const downloadUrl = `${appwriteEndpoint}/storage/buckets/${bucketId}/files/${fileId}/view`;
        // Send success response
        res.status(200).json({
            success: true,
            fileId: fileId,
            fileName: fileName,
            downloadUrl: downloadUrl,
        });
    }
    catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({
            success: false,
            error: error.message.includes("Video unavailable")
                ? "Video not found"
                : "Processing failed",
            details: error.message,
        });
    }
    finally {
        // Cleanup temporary file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlink(tempFilePath, (err) => {
                if (err)
                    console.error("Temp file cleanup error:", err);
            });
        }
    }
}
// Set up router
const router = express.Router();
router.post("/get-mp3", getMp3);
export default router;
