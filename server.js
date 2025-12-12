require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const Replicate = require("replicate");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const app = express();

// ============= LOGS (مهم لرؤية طلبات الموبايل) =============
app.use(morgan("dev"));

// ============= JSON LIMIT (لتحمل برومبت كبير) =============
app.use(express.json({ limit: "2mb" }));

// ============= CORS (تحسين) =============
app.use(
    cors({
        origin: "*",
        methods: ["POST"],
        allowedHeaders: ["Content-Type", "x-api-key"]
    })
);

// ============= RATE LIMIT (حماية ضد الـ Spam) =============
app.use(
    rateLimit({
        windowMs: 60 * 1000,
        max: 20,
        message: { error: "Too many requests, try again later." }
    })
);

// ============= API KEY PROTECTION (حماية التطبيق) =============
app.use((req, res, next) => {
    const key = req.headers["x-api-key"];
    if (!key || key !== process.env.APP_KEY) {
        return res.status(403).json({ error: "Not authorized" });
    }
    next();
});

// ============= MULTER STORAGE (تسمية أفضل للملفات) =============
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter(req, file, cb) {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error("Only JPG, PNG, WebP allowed"));
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

        // قراءة الصورة Base64
        const imageBuffer = fs.readFileSync(imagePath);
        const ext = req.file.mimetype.split("/")[1];
        const base64Image = `data:image/${ext};base64,${imageBuffer.toString("base64")}`;

        // تشغيل نموذج الذكاء الاصطناعي
        const output = await replicate.run(
            "black-forest-labs/flux-lora:1c638b7bdfac18ad5a1bcbbf2da61e9f4dd732e6f8cb40c9a49b6ecfc43bfe3d",
            {
                input: {
                    prompt: prompt,
                    image: base64Image
                }
            }
        );

        // حذف الصورة المؤقتة
        fs.unlink(imagePath, err => {
            if (err) console.warn("Failed to delete temp image:", err);
        });

        return res.json({
            edited_image: output
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: "Server error",
            details: err.message
        });
    }
});

// ============= تشغيل السيرفر =============
app.listen(3000, () =>
    console.log("Server is running on port 3000")
);
