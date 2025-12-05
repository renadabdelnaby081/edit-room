require("dotenv").config();   // ← مهم جدًا

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const Replicate = require("replicate");

const app = express();
app.use(cors());
app.use(express.json());

// ============= MULTER (رفع الصور) =============
const upload = multer({ dest: "uploads/" });

// ============= REPLICATE CLIENT =============
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_KEY   // ← هنا نحط API Key من .env
});

// ============= EDIT ROOM API =============
app.post("/edit-room", upload.single("image"), async (req, res) => {
    try {
        const prompt = req.body.prompt;
        const imagePath = req.file.path;

        // قراءة الصورة Base64
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

        // تشغيل الموديل
        const output = await replicate.run(
            "black-forest-labs/flux-lora:1c638b7bdfac18ad5a1bcbbf2da61e9f4dd732e6f8cb40c9a49b6ecfc43bfe3d",
            {
                input: {
                    prompt: prompt,
                    image: base64Image
                }
            }
        );

        // حذف الصورة من السيرفر بعد التشغيل
        fs.unlinkSync(imagePath);

        return res.json({
            edited_image: output
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// ============= SERVER LISTEN =============
app.listen(7860, () => {
    console.log("Backend running on http://127.0.0.1:7860");
});
