require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const Replicate = require("replicate");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(cors());
app.use(express.json());

// ============= RATE LIMIT (حماية مهمة جدًا) =============
app.use(
    rateLimit({
        windowMs: 60 * 1000,
        max: 20, // 20 طلب في الدقيقة لكل User
        message: { error: "Too many requests, try again later." }
    })
);

// ============= حماية API بسيطة للموبايل =============
app.use((req, res, next) => {
    const key = req.headers["x-api-key"];
    if (!key || key !== process.env.APP_KEY) {
        return res.status(403).json({ error: "Not authorized" });
    }
    next();
});

// ============= MULTER CONFIG =============
const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 6 * 1024 * 1024 }, // 6MB
    fileFilter(req, file, cb) {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
            cb(new Error("Only JPG, PNG, WebP allowed"));
        } else {
            cb(null, true);
        }
    }
});

// ============= REPLICATE CLIENT =============
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_KEY
});

// ============= EDIT ROOM API =============
app.post("/edit-room", upload.single("image"), async (req, res) => {
    try {
        const prompt = req.body.prompt;
        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        const imagePath = req.file.path;

        // قراءة الصورة Base64 بشكل نظيف
        const imageBuffer = fs.readFileSync(imagePath);
        const ext = req.file.mimetype.split("/")[1];
        const base64Image = `data:image/${ext};base64,${imageBuffer.toString("base64")}`;

        // تشغيل الموديل (نفس الموديل بدون أي تغيير)
        const output = await replicate.run(
            "black-forest-labs/flux-lora:1c638b7bdfac18ad5a1bcbbf2da61e9f4dd732e6f8cb40c9a49b6ecfc43bfe3d",
            {
                input: {
                    prompt: prompt,
                    image: base64Image
                }
            }
        );

        // حذف الصورة بشكل آمن
        fs.unlink(imagePath, () => {});

        return res.json({
            edited_image: output
        });

    } catch (err)
