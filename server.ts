import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.warn("[SERVER] WARNING: SUPABASE_URL or SUPABASE_ANON_KEY is missing. Database features will fail.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function translateContent(text: string, description: string) {
  try {
    const prompt = `Translate the following hotel menu item name and description into English (en), Arabic (ar), Turkish (tr), and Kurdish Sorani (ku). 
    Return ONLY a JSON object with keys 'name' and 'description', each containing sub-keys for the languages.
    Name: ${text}
    Description: ${description}
    Format: { "name": { "en": "...", "ar": "...", "tr": "...", "ku": "..." }, "description": { "en": "...", "ar": "...", "tr": "...", "ku": "..." } }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Translation error:", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json());

  // Global request logging
  app.use((req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
      console.log(`[SERVER] ${req.method} ${req.url}`);
    }
    next();
  });

  const api = express.Router();

  // Mount API router EARLY
  app.use("/api", api);

  // Health check on main app
  app.get("/health-check", (req, res) => {
    res.json({ status: "ok", service: "hills-hotel-api" });
  });

  // Health check on API router
  api.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Settings API
  api.get("/settings", async (req, res) => {
    try {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (error && error.code !== 'PGRST116') throw error;
      res.json(data || { hotel_name: 'Hills Hotel', currency: 'IQD' });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  api.put("/settings", async (req, res) => {
    try {
      const { hotel_name, currency } = req.body;
      const { error } = await supabase.from("settings").upsert({ id: 1, hotel_name, currency });
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Categories API
  api.get("/categories", async (req, res) => {
    try {
      const { data, error } = await supabase.from("categories").select("*");
      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  api.get("/menu/:categorySlug", async (req, res) => {
    try {
      const { categorySlug } = req.params;
      
      // First get category id
      const { data: catData, error: catError } = await supabase.from("categories").select("id").eq("slug", categorySlug).single();
      if (catError) throw catError;

      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("category_id", catData.id)
        .eq("available", true);
      
      if (error) throw error;
      res.json(data.map((i: any) => ({ ...i, translations: typeof i.translations === 'string' ? JSON.parse(i.translations) : i.translations })));
    } catch (error) {
      console.error(`Error fetching menu for ${req.params.categorySlug}:`, error);
      res.status(500).json({ error: "Failed to fetch menu items" });
    }
  });

  api.get("/admin/menu/:categorySlug", async (req, res) => {
    try {
      const { categorySlug } = req.params;
      const { data: catData, error: catError } = await supabase.from("categories").select("id").eq("slug", categorySlug).single();
      if (catError) throw catError;

      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("category_id", catData.id);
      
      if (error) throw error;
      res.json(data.map((i: any) => ({ ...i, translations: typeof i.translations === 'string' ? JSON.parse(i.translations) : i.translations })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.post("/admin/menu", async (req, res) => {
    try {
      const { category_id, name, description, price, image_url } = req.body;
      const translations = await translateContent(name, description);
      
      const { data, error } = await supabase.from("menu_items").insert({
        category_id, name, description, translations, price, image_url
      }).select().single();
      
      if (error) throw error;
      res.json({ id: data.id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.put("/admin/menu/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, price, image_url, available } = req.body;
      
      const { data: existing, error: fetchError } = await supabase.from("menu_items").select("name, description").eq("id", id).single();
      if (fetchError) throw fetchError;

      let translations;
      if (existing.name !== name || existing.description !== description) {
        translations = await translateContent(name, description);
      }

      const updateData: any = { name, description, price, image_url, available };
      if (translations) updateData.translations = translations;

      const { error } = await supabase.from("menu_items").update(updateData).eq("id", id);
      if (error) throw error;
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.delete("/admin/menu/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.post("/orders", async (req, res) => {
    try {
      const { category_id, location, items, total_price, currency } = req.body;
      const { data, error } = await supabase.from("orders").insert({
        category_id, location, items, total_price, currency
      }).select().single();
      
      if (error) throw error;
      io.emit("new_order", data);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.get("/admin/orders/:categorySlug", async (req, res) => {
    try {
      const { categorySlug } = req.params;
      const { data: catData, error: catError } = await supabase.from("categories").select("id").eq("slug", categorySlug).single();
      if (catError) throw catError;

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("category_id", catData.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      res.json(data.map((o: any) => ({ ...o, items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.patch("/admin/orders/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // API 404 handler
  api.use((req, res) => {
    console.warn(`[API 404] ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[GLOBAL ERROR]", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
