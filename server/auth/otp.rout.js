import { Router } from "express";
import mongoose from "mongoose";
import { sendOTPEmail } from "./email/nodemailer.config.js";
import { authenticate } from "./jwt/access.AI.token.js";
import "dotenv/config";

const otp_router = Router();

// OTP Schema for storing temporary OTP codes
const otpSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  email: { type: String, required: true },
  otp: { type: String, required: true },
  verified: { type: Boolean, default: false },
  createdAt: { 
    type: Date, 
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  }
});

const OTPData = mongoose.models.OTP || mongoose.model("OTP", otpSchema);

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP to user's email during login
otp_router.post("/send-otp", async (req, res) => {
  try {
    const { userId, email, username } = req.body;

    console.log("📤 Send OTP Request:", { userId, email, username });

    if (!userId || !email || !username) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields (userId, email, username)" 
      });
    }

    // Delete any existing OTP for this user
    const deleteResult = await OTPData.deleteMany({ userId });
    console.log("🗑️ Deleted existing OTPs:", deleteResult.deletedCount);

    // Generate new OTP
    const otp = generateOTP();
    console.log("🎲 Generated OTP:", otp);

    // Calculate expiry time (10 minutes from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    // Save OTP to database
    const otpRecord = new OTPData({
      userId,
      email,
      otp,
      verified: false,
      createdAt: now,
      expiresAt: expiresAt
    });
    
    const savedRecord = await otpRecord.save();
    console.log("✅ OTP Saved to DB:", {
      _id: savedRecord._id,
      userId: savedRecord.userId,
      email: savedRecord.email,
      otp: savedRecord.otp,
      verified: savedRecord.verified,
      expiresAt: savedRecord.expiresAt
    });

    // Verify it was saved
    const verifyInDB = await OTPData.findOne({ userId, otp });
    console.log("🔍 Verify in DB - Record exists:", verifyInDB ? "YES ✓" : "NO ✗");

    // Send OTP email
    const emailSent = await sendOTPEmail(email, username, otp);

    if (!emailSent) {
      return res.status(500).json({ 
        success: false, 
        error: "Failed to send OTP email" 
      });
    }

    res.json({ 
      success: true, 
      message: "OTP sent to email",
      otpId: savedRecord._id,
      expiresAt: expiresAt
    });
  } catch (err) {
    console.error("❌ Error sending OTP:", err);
    res.status(500).json({ success: false, error: "Failed to send OTP" });
  }
});

// Verify OTP
otp_router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    console.log("\n🔐 Verify OTP Request:", { userId, otp });

    if (!userId || !otp) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing userId or OTP" 
      });
    }

    // Debug: Check all OTPs for this user
    const allOTPs = await OTPData.find({ userId });
    console.log("📋 All OTPs for this user:", allOTPs.length > 0 ? allOTPs : "NONE FOUND");

    // Find OTP record - fetch all OTPs for this user
    const otpRecord = await OTPData.findOne({ userId, otp, verified: false });

    console.log("🔍 Searching for: userId=" + userId + ", otp=" + otp + ", verified=false");
    console.log("📋 OTP Record Found:", otpRecord ? "YES ✓" : "NO ✗");

    if (!otpRecord) {
      console.log("❌ OTP not found in database or already verified");
      console.log("📊 Checking if OTP exists with any status...");
      const anyOTP = await OTPData.findOne({ userId, otp });
      if (anyOTP) {
        console.log("⚠️ Found OTP but verified status is:", anyOTP.verified);
      }
      return res.status(400).json({ 
        success: false, 
        error: "Invalid OTP or OTP already used" 
      });
    }

    // Check if OTP has expired
    const now = new Date();
    console.log("⏰ Time Check - Now:", now.toISOString(), "ExpiresAt:", otpRecord.expiresAt.toISOString());

    if (now > otpRecord.expiresAt) {
      console.log("⏳ OTP Expired - NOT deleting, just rejecting");
      return res.status(400).json({ 
        success: false, 
        error: "OTP has expired. Please request a new one.",
        expired: true
      });
    }

    // Mark as verified (don't delete, just mark verified)
    console.log("✅ OTP Verified - Marking as verified");
    otpRecord.verified = true;
    await otpRecord.save();

    res.json({ 
      success: true, 
      message: "OTP verified successfully" 
    });
  } catch (err) {
    console.error("❌ Error verifying OTP:", err);
    res.status(500).json({ success: false, error: "Failed to verify OTP" });
  }
});

// Cleanup expired OTPs (runs periodically)
async function cleanupExpiredOTPs() {
  try {
    const now = new Date();
    const result = await OTPData.deleteMany({ expiresAt: { $lt: now } });
    console.log(`🧹 Cleanup: Deleted ${result.deletedCount} expired OTP records`);
  } catch (err) {
    console.error("❌ Cleanup Error:", err);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

// Resend OTP (in case user didn't receive it)
otp_router.post("/resend-otp", async (req, res) => {
  try {
    const { userId, email, username } = req.body;

    if (!userId || !email || !username) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields" 
      });
    }

    // Find existing OTP
    const existingOTP = await OTPData.findOne({ userId });

    if (!existingOTP) {
      return res.status(400).json({ 
        success: false, 
        error: "No OTP request found. Please login again." 
      });
    }

    // Generate new OTP
    const newOtp = generateOTP();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    existingOTP.otp = newOtp;
    existingOTP.verified = false;
    existingOTP.createdAt = now;
    existingOTP.expiresAt = expiresAt;
    await existingOTP.save();

    // Send new OTP email
    const emailSent = await sendOTPEmail(email, username, newOtp);

    if (!emailSent) {
      return res.status(500).json({ 
        success: false, 
        error: "Failed to send OTP email" 
      });
    }

    res.json({ 
      success: true, 
      message: "OTP resent to email",
      expiresAt: expiresAt
    });
  } catch (err) {
    console.error("Error resending OTP:", err);
    res.status(500).json({ success: false, error: "Failed to resend OTP" });
  }
});

export default otp_router;
