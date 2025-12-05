import { Router } from "express";
import multer from "multer";
import { resolve, join } from "path";
import "dotenv/config";
import { Groq } from "groq-sdk";
import fs from "fs";
import pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import fetch from "node-fetch";

const apiKey = process.env.API_KEY;
if (!apiKey) {
	throw new Error("API key Invalid");
}

const uploadFold = resolve(".", "uploads");
const routerApp = Router();

// 🔥 Store PDF text per user instead of global
const userTexts = {};

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
function clearUploadMiddleware(req, res, next) {
	clearUploadFolder();
	next();
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

// Upload endpoint
routerApp.post(
	"/upload",
	clearUploadMiddleware,
	upload.single("file"),
	async (req, res) => {
		if (!req.file) return res.status(400).json({ error: "No file uploaded" });

		const filePath = join(uploadFold, req.file.filename);
		const userId = req.body.userId || "guest"; // 🔥 track user

		try {
			if (req.file.mimetype === "application/pdf") {
				// 🔥 Save text per user
				userTexts[userId] = await extractPDFText(filePath);

				res.json({
					message: "PDF processed successfully",
					text: userTexts[userId],
				});
			} else {
				userTexts[userId] = ""; // reset for non-PDFs

				res.json({
					message: "File uploaded, but not a PDF. No extraction done.",
					filename: req.file.originalname,
				});
			}
		} catch (err) {
			console.error("File processing failed", err);
			res.status(500).json({
				error: "File processing failed",
				details: err.message,
			});
		}
	}
);

routerApp.post("/api", async (req, res) => {
	let query = req.body.val;
	const ARCHIVE_SEARCH = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
		query
	)}&output=json`;

	try {
		const searchResp = await fetch(ARCHIVE_SEARCH);
		const searchData = await searchResp.json();
		const resultArr = searchData.response.docs.slice(0, 10);

		const pdfItems = resultArr.filter((metaData) =>
			metaData.format.some((f) => f.toLowerCase().includes("pdf"))
		);

		let resultsWithLinks = [];

		for (const item of pdfItems) {
			const metadataResp = await fetch(
				`https://archive.org/metadata/${item.identifier}`
			);
			const metadata = await metadataResp.json();

			if (metadata.files && metadata.files.length) {
				const pdfFiles = metadata.files.filter((f) =>
					f.name.toLowerCase().endsWith(".pdf")
				);

				if (pdfFiles.length) {
					pdfFiles.forEach((file) => {
						resultsWithLinks.push({
							title: item.title,
							creator: item.creator,
							year: item.year,
							pdfLink: `https://archive.org/download/${item.identifier}/${file.name}`,
						});
					});
				}
			}
		}
		res.json(resultsWithLinks);
	} catch (err) {
		console.log("Unable to load data");
		res.status(500).json({ error: "Failed to fetch PDF links" });
	}
});

routerApp.get("/summary", async (req, res) => {
	try {
		const groq = new Groq({ apiKey });

		const userId = req.query.userId || "guest";

		const text = userTexts[userId] || ""; // 🔥 correct per-user text

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

		res.json({
			success: true,
			ai: fullAI,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, error: "AI summarization failed" });
	}
});

export default routerApp;
