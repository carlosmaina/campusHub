import cors from "cors";
import "dotenv/config";
import express from "express";
// import session from "express-session";
import mongoose from "mongoose";
import archive_router from "./router_Archive_upload.js";
import router_AI_App from "./routers_AI.js";
import login_router from "./auth/login.rout.js";
import sign_router from "./auth/sign.rout.js";
import oauth_router from "./auth/oauth.rout.js";

const app = express();
mongoose.connect(process.env.MONGODB_URL).then(() => console.log("Connected to the database")).catch(() => {
	console.log("Unable to connect to the database");
})
const PORT = process.env.PORT || 8000;

app.use(express.urlencoded({ extended: true }));
app.use(
	cors({
		origin: ["http://localhost:5173","https://campus-hub-frontend-five.vercel.app/"],
		credentials: true,
		allowedHeaders: [
			"Origin",
			"X-Requested-With",
			"Content-Type",
			"Accept",
			"Authorization",
			"Cache-Control"
		]
	})
);
// app.use(
// 	session({
// 		secret: "campushub_secret",
// 		resave: false,
// 		saveUninitialized: true,
// 		cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
// 	})
// );
// middleware parsing json data
app.use(express.json());
// routes paths
app.use("/", router_AI_App);
app.use("/", archive_router);
app.use("/", login_router)
app.use("/", sign_router)
app.use("/auth", oauth_router)
app.use((req, res) => res.status(500).json("Server Error"));

app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
