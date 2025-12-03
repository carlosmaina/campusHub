import { Router } from "express";
import multer from "multer";
import { resolve, join } from "path";
import "dotenv/config";
import fs from "fs";
import pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import fetch from "node-fetch";

const apiKey = "AIzaSyBISuZntU40vGHbwWWHue-8JBd-fW7ssK8";
const MODEL_NAME = "gemini-2.5-pro"; // use valid model
const API_URL_2 = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
if (!apiKey) {
	throw new Error("API key Invalid");
}

const uploadFold = resolve(".", "uploads");
const routerApp = Router();

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
let fullText = "";
routerApp.post(
	"/upload",
	clearUploadMiddleware,
	upload.single("file"),
	async (req, res) => {
		if (!req.file) return res.status(400).json({ error: "No file uploaded" });

		const filePath = join(uploadFold, req.file.filename);

		try {
			if (req.file.mimetype === "application/pdf") {
				fullText = await extractPDFText(filePath);
				res.json({
					message: "PDF processed successfully",
					text: fullText,
				});
			} else {
				fullText = ""; // reset for non-PDFs
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

		// Filter items that have a PDF format
		const pdfItems = resultArr.filter((metaData) =>
			metaData.format.some((f) => f.toLowerCase().includes("pdf"))
		);
		let resultsWithLinks = [];

		// For each filtered item, get metadata to find PDF file names
		for (const item of pdfItems) {
			const metadataResp = await fetch(
				`https://archive.org/metadata/${item.identifier}`
			);
			const metadata = await metadataResp.json();

			if (metadata.files && metadata.files.length) {
				// Find files ending with .pdf (or containing "pdf" in format)
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
		await fetch(API_URL_2, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				contents: [
					{ parts: [{ text: `Summarize this content clearly${fullText}` }] },
				],
			}),
		})
			.then((data) => data.json())
			.then((d) => {
				if (!d.candidates) return res.json("No available tokens");
				return res.json(d.candidates[0].content.parts[0].text);
			});
	} catch (err) {
		console.log("Error...");
	}
});
export default routerApp;
