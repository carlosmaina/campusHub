import cors from "cors";
import express from "express";
import routerApp from "./routers.js";
import { resolve } from "path";

const app = express();
const PORT = process.env.PORT || 8080;
app.use("/uploads", express.static(resolve(".", "uploads")));
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"], // allow any header
  })
);
app.use(express.json());
app.use("/", routerApp);
app.use((req, res) => res.send("Server Error"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
