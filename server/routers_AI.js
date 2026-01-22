import { Router } from "express";
import multer from "multer";
import { resolve, join } from "path";
import { Groq } from "groq-sdk";
import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { authenticate } from "./auth/jwt/access.AI.token.js";
import mongoose from "mongoose";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API key Invalid");
}
const uploadFold = resolve(".", "uploads");
const router_AI_App = Router();

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFold),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });
// Clear upload folder
function clearUploadFolder() {
  if (!fs.existsSync(uploadFold)) return;
  const files = fs.readdirSync(uploadFold);
  for (const file of files) fs.unlinkSync(join(uploadFold, file));
}

// Safely delete a file with error handling
async function safeDeleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`File deleted successfully: ${filePath}`);
      return true;
    }
  } catch (err) {
    console.error(`Failed to delete file ${filePath}:`, err.message);
    return false;
  }
}

// Extract text from PDF
async function extractPDFText(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const typedArray = new Uint8Array(fileBuffer);
  const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    let pageText = "";
    let lastY = null;
    content.items.forEach((item) => {
      const currentY = item.transform[5];
      if (lastY !== null && Math.abs(lastY - currentY) > 5) pageText += "\n";
      pageText += item.str + " ";
      lastY = currentY;
    });
    fullText += pageText + "\n\n";
  }
  return fullText.replace(/\r\n/g, "\n").trim();
}

// Connect to MongoDB
// mongoose.connect('mongodb://localhost:27017/campusHub', { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log('MongoDB connected'))
//   .catch(err => console.error('MongoDB connection error:', err));

// Define a schema for PDF data with userId, course, unit, and extracted text
const pdfSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: String,
  title: String,
  pdfBuffer: Buffer,
  extractedText: String,
  course: { type: String, default: "General" }, // Academic course/unit
  unit: { type: String, default: "Uncategorized" }, // Learning unit
  uploadedBy: { type: String, enum: ["student", "lecturer"], default: "student" }, // Track who uploaded
  isPublic: { type: Boolean, default: true }, // Resource visibility
  tags: [String], // For better searchability
  views: { type: Number, default: 0 }, // Track popularity
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Create a model for PDF data
const PdfData = mongoose.models.pdfData || mongoose.model("PdfData", pdfSchema);

// Define a schema for saved summaries
const summarySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: String,
  pdfTitle: String, // Original PDF title
  summary: { type: String, required: true }, // AI-generated summary
  course: String, // Course from PDF metadata
  unit: String, // Unit from PDF metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Create a model for summaries
const SummaryData = mongoose.models.Summary || mongoose.model("Summary", summarySchema);

// Define a schema for notifications
const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ["welcome", "upload", "system", "info"], default: "info" },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Create a model for notifications
const NotificationData = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

// Function to save PDF data to the database with complete metadata
const savePdfData = async (userId, username, title, pdfBuffer, extractedText, uploadedBy, course = "General", unit = "Uncategorized") => {
  const pdfData = new PdfData({ 
    userId, 
    username,
    title, 
    pdfBuffer, 
    extractedText,
    uploadedBy,
    course,
    unit,
    isPublic: true 
  });
  await pdfData.save();
};

// Function to retrieve PDF data from the database by userId
const getPdfDataByUserId = async (userId) => {
  return await PdfData.findOne({ userId }).sort({ createdAt: -1 });
};

router_AI_App.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = join(uploadFold, req.file.filename);
  const { userId, username, uploadedBy, course, unit } = req.body;
  
  if (!userId || !username) {
    await safeDeleteFile(filePath);
    return res.status(400).json({ error: "User ID and username required" });
  }

  try {
    if (req.file.mimetype === "application/pdf") {
      // Extract text from PDF
      const extractedText = await extractPDFText(filePath);

      // Save PDF data to the database with full metadata
      await savePdfData(
        userId,
        username,
        req.file.originalname,
        fs.readFileSync(filePath),
        extractedText,
        uploadedBy || "student",
        course || "General",
        unit || "Uncategorized"
      );

      // Delete the file safely after successful database save
      const deleteSuccess = await safeDeleteFile(filePath);

      res.json({
        message: "PDF processed and saved to database successfully",
        text: extractedText,
        userId: userId,
        fileDeleted: deleteSuccess,
      });
    } else {
      // Delete non-PDF files safely
      await safeDeleteFile(filePath);

      res.json({
        message: "File uploaded, but not a PDF. No extraction done.",
        filename: req.file.originalname,
      });
    }
  } catch (err) {
    console.error("File processing failed", err);
    // Attempt to delete file on error
    await safeDeleteFile(filePath);
    res.status(500).json({
      error: "File processing failed",
      details: err.message,
    });
  }
});
router_AI_App.get("/summary", authenticate, async (req, res) => {
  try {
    const groq = new Groq({ apiKey });
    const userId = req.query.userId || "guest";

    // Fetch PDF data independently from the database
    const pdfRecord = await getPdfDataByUserId(userId);
    const text = pdfRecord?.extractedText || "";

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "No PDF data found for this user. Please upload a PDF first.",
      });
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Give me a short summary of this text:\n${text}`,
        },
      ],
      model: "openai/gpt-oss-20b",
      temperature: 1,
      max_completion_tokens: 8192,
      stream: true,
    });

    let fullAI = "";

    for await (const chunk of chatCompletion) {
      const piece = chunk.choices[0]?.delta?.content;
      if (piece) fullAI += piece;
    }
    // sending response
    res.json({
      success: true,
      ai: fullAI,
    });
  } catch (err) {
    console.log("Network error");
    res.status(500).json({ success: false, error: "AI summarization failed" });
  }
});

// Get all available courses/units for filtering
router_AI_App.get("/courses", authenticate, async (req, res) => {
  try {
    const courses = await PdfData.distinct("course");
    const units = await PdfData.distinct("unit");
    res.json({ success: true, courses, units });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch courses" });
  }
});

// Search resources by course and unit
router_AI_App.get("/search", authenticate, async (req, res) => {
  try {
    const { course, unit, query } = req.query;
    let searchFilter = { isPublic: true };
    
    if (course) searchFilter.course = course;
    if (unit) searchFilter.unit = unit;
    if (query) {
      searchFilter.$or = [
        { title: { $regex: query, $options: "i" } },
        { extractedText: { $regex: query, $options: "i" } },
        { tags: { $in: [query] } }
      ];
    }
    
    const results = await PdfData.find(searchFilter, "-pdfBuffer")
      .sort({ views: -1, createdAt: -1 })
      .limit(20);
    
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: "Search failed" });
  }
});

// Get user's uploaded resources
router_AI_App.get("/myresources", authenticate, async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, error: "User ID required" });
    
    const resources = await PdfData.find({ userId }, "-pdfBuffer")
      .sort({ createdAt: -1 });
    
    res.json({ success: true, resources });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch your resources" });
  }
});

// Increment view count for a resource
router_AI_App.post("/view/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await PdfData.updateOne({ _id: id }, { $inc: { views: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to track view" });
  }
});

// Delete a resource (only owner or admin can delete)
router_AI_App.delete("/resource/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId;
    
    const resource = await PdfData.findById(id);
    if (!resource) return res.status(404).json({ success: false, error: "Resource not found" });
    
    if (resource.userId !== userId) {
      return res.status(403).json({ success: false, error: "Unauthorized to delete this resource" });
    }
    
    await PdfData.deleteOne({ _id: id });
    res.json({ success: true, message: "Resource deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to delete resource" });
  }
});

// Save AI summary to database
router_AI_App.post("/save-summary", authenticate, async (req, res) => {
  try {
    const { userId, username, pdfTitle, summary, course, unit } = req.body;
    
    if (!userId || !summary) {
      return res.status(400).json({ success: false, error: "UserId and summary required" });
    }

    const newSummary = new SummaryData({
      userId,
      username,
      pdfTitle,
      summary,
      course,
      unit,
    });

    await newSummary.save();
    res.json({ 
      success: true, 
      message: "Summary saved successfully",
      summaryId: newSummary._id 
    });
  } catch (err) {
    console.error("Error saving summary:", err);
    res.status(500).json({ success: false, error: "Failed to save summary" });
  }
});

// Get all saved summaries for a user
router_AI_App.get("/saved-summaries", authenticate, async (req, res) => {
  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID required" });
    }

    const summaries = await SummaryData.find({ userId })
      .sort({ createdAt: -1 });

    res.json({ 
      success: true, 
      summaries,
      count: summaries.length 
    });
  } catch (err) {
    console.error("Error fetching summaries:", err);
    res.status(500).json({ success: false, error: "Failed to fetch saved summaries" });
  }
});

// Delete a saved summary
router_AI_App.delete("/summary/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId;

    const summary = await SummaryData.findById(id);
    if (!summary) {
      return res.status(404).json({ success: false, error: "Summary not found" });
    }

    if (summary.userId !== userId) {
      return res.status(403).json({ success: false, error: "Unauthorized to delete this summary" });
    }

    await SummaryData.deleteOne({ _id: id });
    res.json({ success: true, message: "Summary deleted successfully" });
  } catch (err) {
    console.error("Error deleting summary:", err);
    res.status(500).json({ success: false, error: "Failed to delete summary" });
  }
});

// Create a new notification
router_AI_App.post("/create-notification", async (req, res) => {
  try {
    const { userId, title, message, type = "info" } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const notification = new NotificationData({
      userId,
      title,
      message,
      type,
      isRead: false,
      createdAt: new Date()
    });

    await notification.save();
    res.status(201).json({ 
      success: true, 
      message: "Notification created",
      notificationId: notification._id 
    });
  } catch (err) {
    console.error("Error creating notification:", err);
    res.status(500).json({ success: false, error: "Failed to create notification" });
  }
});

// Get all notifications for a user
router_AI_App.get("/notifications", authenticate, async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID required" });
    }

    const notifications = await NotificationData.find({ userId })
      .sort({ createdAt: -1 });

    res.json({ 
      success: true, 
      notifications,
      count: notifications.length 
    });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
});

// Delete a notification
router_AI_App.delete("/notification/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId;

    const notification = await NotificationData.findById(id);
    if (!notification) {
      return res.status(404).json({ success: false, error: "Notification not found" });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ success: false, error: "Unauthorized to delete this notification" });
    }

    await NotificationData.deleteOne({ _id: id });
    res.json({ success: true, message: "Notification deleted successfully" });
  } catch (err) {
    console.error("Error deleting notification:", err);
    res.status(500).json({ success: false, error: "Failed to delete notification" });
  }
});

export default router_AI_App;
