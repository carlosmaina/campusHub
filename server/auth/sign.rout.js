import { Router } from "express";
import sign_model from "./models/sign.model.js";
let sign_router = Router();
sign_router.post("/sign", sign_model, (req, res) => {
    res.status(200).json("signed in");
})
export default sign_router;
