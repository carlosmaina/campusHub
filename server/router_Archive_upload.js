import { Router } from "express";
let archive_router = Router();
archive_router.post("/api", async (req, res) => {
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
		console.log("Unable to load archive pdf data");
		res.status(500).json({ error: "Failed to fetch PDF links" });
	}
});
export default archive_router;
