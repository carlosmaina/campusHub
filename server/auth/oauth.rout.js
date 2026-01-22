import express from "express";
import jwt from "jsonwebtoken";
import { oauth2client } from "./jwt/auto.id.js";
import sign_model from "./models/sign.model.js";
import login_model from "./models/login.model.js";

const router = express.Router();

// Helper function to create JWT tokens
const createToken = (user) => {
  const token = jwt.sign(
    {
      user: user.username,
      userId: user._id,
      role: user.role || "student",
    },
    process.env.JWT_SECRET || "your_secret_key",
    { expiresIn: "7d" },
  );

  return {
    message: "User logged in",
    token,
    user: user.username,
    userId: user._id.toString(),
    role: user.role || "student",
    email: user.email,
  };
};

// Google Login Route
router.post("/google-login", async (req, res) => {
  try {
    const { token } = req.body;

    // Verify token with Google
    const ticket = await oauth2client.verifyIdToken({
      idToken: token,
      audience:
        process.env.REACT_APP_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const username = payload.name;

    // Check if user exists
    let user = await LoginModel.findOne({ email });

    if (!user) {
      return res.status(401).json({
        error: "User doesn't exist. Please sign up first.",
      });
    }

    // Create token and send response
    const response = createToken(user);
    res.json(response);
  } catch (error) {
    console.error("Google login error:", error);
    res.status(401).json({ error: "Invalid Google token" });
  }
});

// Google Signup Route
router.post("/google-signup", async (req, res) => {
  try {
    const { token, role } = req.body;

    // Verify token with Google
    const ticket = await oauth2client.verifyIdToken({
      idToken: token,
      audience:
        process.env.REACT_APP_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const username = payload.name || payload.email.split("@")[0];

    // Check if user already exists
    const existingUser = await LoginModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "user already exists" });
    }

    // Create new user
    const newUser = new SignModel({
      username,
      email,
      password: "oauth-google-" + Math.random().toString(36), // OAuth users don't need password
      role: role || "student",
    });

    await newUser.save();

    // Also update LoginModel
    const loginUser = new LoginModel({
      email,
      password: "oauth-google-" + Math.random().toString(36),
      role: role || "student",
    });

    await loginUser.save();

    // Create token and send response
    const response = createToken(newUser);
    res.json({ message: "signed in", ...response });
  } catch (error) {
    console.error("Google signup error:", error);
    res.status(400).json({ error: "Google signup failed" });
  }
});

// Apple Login Route
router.post("/apple-login", async (req, res) => {
  try {
    const { authorization } = req.body;

    if (!authorization || !authorization.id_token) {
      return res.status(401).json({ error: "Invalid Apple token" });
    }

    // In production, verify the token with Apple's servers
    // For now, we'll decode it (you should properly verify in production)
    const payload = jwt.decode(authorization.id_token);

    const email = payload.email;
    const username = payload.email.split("@")[0];

    // Check if user exists
    let user = await LoginModel.findOne({ email });

    if (!user) {
      return res.status(401).json({
        error: "User doesn't exist. Please sign up first.",
      });
    }

    // Create token and send response
    const response = createToken(user);
    res.json(response);
  } catch (error) {
    console.error("Apple login error:", error);
    res.status(401).json({ error: "Invalid Apple token" });
  }
});

// Apple Signup Route
router.post("/apple-signup", async (req, res) => {
  try {
    const { authorization, role } = req.body;

    if (!authorization || !authorization.id_token) {
      return res.status(401).json({ error: "Invalid Apple token" });
    }

    // Decode token (should be verified in production)
    const payload = jwt.decode(authorization.id_token);

    const email = payload.email;
    const username = payload.email.split("@")[0];

    // Check if user already exists
    const existingUser = await LoginModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "user already exists" });
    }

    // Create new user
    const newUser = new SignModel({
      username,
      email,
      password: "oauth-apple-" + Math.random().toString(36), // OAuth users don't need password
      role: role || "student",
    });

    await newUser.save();

    // Also update LoginModel
    const loginUser = new LoginModel({
      email,
      password: "oauth-apple-" + Math.random().toString(36),
      role: role || "student",
    });

    await loginUser.save();

    // Create token and send response
    const response = createToken(newUser);
    res.json({ message: "signed in", ...response });
  } catch (error) {
    console.error("Apple signup error:", error);
    res.status(400).json({ error: "Apple signup failed" });
  }
});

export default router;
