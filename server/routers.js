import { Router } from "express";
import fetch from "node-fetch";
import multer from "multer";
import { resolve, join } from "path";
import fs from "fs";
import path from "path";
// import pfdparse from "pdf-parse";
let uploadFold = resolve(".", "uploads");
let routerApp = Router();

// configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFold); // folder to save files
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

routerApp.get("/api", (req, res) => {
  res.send("<h1>Working</h1>");
});

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
function clearUploads(req, res, next) {
  fs.readdir(uploadFold, (err, files) => {
    if (err) return next();
    files.forEach((file) => {
      fs.unlink(join(uploadFold, file), (err) => {
        if (err) return console.error("Failed to delete:", file);
      });
    });
    next();
  });
}
// update your route
routerApp.post("/upload", clearUploads, upload.single("file"), (req, res) => {
  console.log("File metadata:", req.file); // file info
  console.log("Extra fields:", req.body); // any extra form fields

  res.json({ message: "File uploaded successfully", file: req.file });
});

export default routerApp;
