import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any;
try {
  db = new Database("hotel.db");
  console.log("Database connected successfully");
} catch (error) {
  console.error("Database connection failed:", error);
  // Fallback to in-memory if file fails (though this shouldn't happen in this env)
  db = new Database(":memory:");
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    hotel_name TEXT DEFAULT 'Hills Hotel',
    currency TEXT DEFAULT 'IQD'
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    translations TEXT, -- JSON string for { en, ar, tr, ku }
    price REAL NOT NULL,
    image_url TEXT,
    available INTEGER DEFAULT 1,
    FOREIGN KEY (category_id) REFERENCES categories (id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    location TEXT NOT NULL,
    items TEXT NOT NULL, -- JSON string
    total_price REAL NOT NULL,
    currency TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id)
  );
`);

// Seed Settings
const settingsCount = db.prepare("SELECT COUNT(*) as count FROM settings").get() as { count: number };
if (settingsCount.count === 0) {
  db.prepare("INSERT INTO settings (id, hotel_name, currency) VALUES (1, ?, ?)").run("Hills Hotel", "IQD");
}

// Seed Categories if empty
const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
if (categoryCount.count === 0) {
  db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)").run("رستوران", "restaurant");
  db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)").run("کافه", "cafe");
  db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)").run("لاندری", "laundry");
}

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
    console.log(`[SERVER] ${req.method} ${req.url}`);
    next();
  });

  const api = express.Router();

  // Health check
  api.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Settings API
  api.get("/settings", (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get();
      res.json(settings || { hotel_name: 'Hills Hotel', currency: 'IQD' });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  api.put("/settings", (req, res) => {
    try {
      const { hotel_name, currency } = req.body;
      db.prepare("UPDATE settings SET hotel_name = ?, currency = ? WHERE id = 1").run(hotel_name, currency);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Categories API
  api.get("/categories", (req, res) => {
    try {
      const categories = db.prepare("SELECT * FROM categories").all();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  api.get("/menu/:categorySlug", (req, res) => {
    try {
      const { categorySlug } = req.params;
      const items = db.prepare(`
        SELECT m.* FROM menu_items m
        JOIN categories c ON m.category_id = c.id
        WHERE c.slug = ? AND m.available = 1
      `).all(categorySlug);
      res.json(items.map((i: any) => ({ ...i, translations: JSON.parse(i.translations || "{}") })));
    } catch (error) {
      console.error(`Error fetching menu for ${req.params.categorySlug}:`, error);
      res.status(500).json({ error: "Failed to fetch menu items" });
    }
  });

  api.get("/admin/menu/:categorySlug", (req, res) => {
    try {
      const { categorySlug } = req.params;
      const items = db.prepare(`
        SELECT m.* FROM menu_items m
        JOIN categories c ON m.category_id = c.id
        WHERE c.slug = ?
      `).all(categorySlug);
      res.json(items.map((i: any) => ({ ...i, translations: JSON.parse(i.translations || "{}") })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.post("/admin/menu", async (req, res) => {
    try {
      const { category_id, name, description, price, image_url } = req.body;
      const translations = await translateContent(name, description);
      
      const result = db.prepare("INSERT INTO menu_items (category_id, name, description, translations, price, image_url) VALUES (?, ?, ?, ?, ?, ?)").run(
        category_id, name, description, JSON.stringify(translations), price, image_url
      );
      res.json({ id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.put("/admin/menu/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, price, image_url, available } = req.body;
      
      const existing = db.prepare("SELECT name, description FROM menu_items WHERE id = ?").get(id) as any;
      let translationsStr;
      if (existing.name !== name || existing.description !== description) {
        const translations = await translateContent(name, description);
        translationsStr = JSON.stringify(translations);
      }

      if (translationsStr) {
        db.prepare("UPDATE menu_items SET name = ?, description = ?, translations = ?, price = ?, image_url = ?, available = ? WHERE id = ?").run(
          name, description, translationsStr, price, image_url, available ? 1 : 0, id
        );
      } else {
        db.prepare("UPDATE menu_items SET name = ?, description = ?, price = ?, image_url = ?, available = ? WHERE id = ?").run(
          name, description, price, image_url, available ? 1 : 0, id
        );
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.delete("/admin/menu/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.post("/orders", (req, res) => {
    try {
      const { category_id, location, items, total_price, currency } = req.body;
      const result = db.prepare("INSERT INTO orders (category_id, location, items, total_price, currency) VALUES (?, ?, ?, ?, ?)").run(
        category_id, location, JSON.stringify(items), total_price, currency
      );
      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(result.lastInsertRowid);
      io.emit("new_order", order);
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.get("/admin/orders/:categorySlug", (req, res) => {
    try {
      const { categorySlug } = req.params;
      const orders = db.prepare(`
        SELECT o.* FROM orders o
        JOIN categories c ON o.category_id = c.id
        WHERE c.slug = ?
        ORDER BY o.created_at DESC
      `).all(categorySlug);
      res.json(orders.map((o: any) => ({ ...o, items: JSON.parse(o.items) })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  api.patch("/admin/orders/:id/status", (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // API 404 handler
  api.use((req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // Mount API router
  app.use("/api", api);

  app.get("/test-json", (req, res) => {
    res.json({ test: "ok", time: new Date().toISOString() });
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

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
