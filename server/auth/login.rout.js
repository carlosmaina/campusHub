import { Router } from "express";
import login_model from "./models/login.model.js";
import { AccessToken } from "./jwt/access.AI.token.js";
let login_router = Router();
login_router.post("/Login", login_model, AccessToken, (req, res) => {
});
export default login_router;