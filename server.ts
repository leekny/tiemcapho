import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini API Proxy for business insights
  app.post("/api/reports/analyze", async (req, res) => {
    try {
      const { reportData } = req.body;
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY || "",
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Bạn là một chuyên gia phân tích kinh doanh cho quán cà phê. 
        Dưới đây là dữ liệu doanh thu và chi phí: ${JSON.stringify(reportData)}. 
        Hãy đưa ra các nhận xét và gợi ý để tối ưu hóa lợi nhuận (ngắn gọn, bằng tiếng Việt).`
      });

      res.json({ analysis: result.text });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to analyze reports" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
