import nodemailer from "nodemailer";
import "dotenv/config";

// Validate email credentials
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn("⚠️  WARNING: EMAIL_USER or EMAIL_PASSWORD not set in .env file");
    console.warn("Welcome emails will not be sent. Add the following to .env:");
    console.warn("EMAIL_USER=your-email@gmail.com");
    console.warn("EMAIL_PASSWORD=your-app-password");
}

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,  // Your Gmail address
        pass: process.env.EMAIL_PASSWORD,  // Your Gmail app password (not regular password)
    }
});

// Function to send welcome email on first login
export async function sendWelcomeEmail(userEmail, userName) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: "Welcome to CampusHub! 🎓",
            html: `
                <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                    <div style="background-color: white; max-width: 600px; margin: 0 auto; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h1 style="color: #2c3e50; margin-top: 0;">Welcome to CampusHub! 🎓</h1>
                        
                        <p style="color: #555; font-size: 16px;">
                            Hi <strong>${userName}</strong>,
                        </p>
                        
                        <p style="color: #555; font-size: 16px; line-height: 1.6;">
                            We're thrilled to have you join the CampusHub community! Your account is now active and ready to use.
                        </p>
                        
                        <h2 style="color: #2c3e50; margin-top: 30px;">Getting Started:</h2>
                        <ul style="color: #555; font-size: 16px; line-height: 1.8;">
                            <li><strong>Upload PDFs:</strong> Share your course materials and documents</li>
                            <li><strong>AI Summaries:</strong> Get instant AI-generated summaries of your PDFs</li>
                            <li><strong>Save & Organize:</strong> Save summaries for later reference</li>
                            <li><strong>Access Resources:</strong> Browse and download resources from your courses</li>
                            <li><strong>Watch Videos:</strong> Access course-related video content</li>
                        </ul>
                        
                        <p style="color: #555; font-size: 16px; line-height: 1.6; margin-top: 20px;">
                            If you have any questions or need assistance, feel free to reach out to our support team.
                        </p>
                        
                        <p style="color: #555; font-size: 16px; margin-top: 30px;">
                            Happy learning!<br>
                            <strong>The CampusHub Team</strong>
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            This is an automated welcome message. Please do not reply to this email.
                        </p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Welcome email sent:", info.response);
        return true;
    } catch (error) {
        console.error("Error sending welcome email:", error);
        return false;
    }
}

// Function to send OTP email
export async function sendOTPEmail(userEmail, userName, otp) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: "Your CampusHub Login OTP 🔐",
            html: `
                <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                    <div style="background-color: white; max-width: 600px; margin: 0 auto; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h1 style="color: #2c3e50; margin-top: 0;">Your Login Verification Code</h1>
                        
                        <p style="color: #555; font-size: 16px;">
                            Hi <strong>${userName}</strong>,
                        </p>
                        
                        <p style="color: #555; font-size: 16px; line-height: 1.6;">
                            You requested to log in to your CampusHub account. Use the code below to verify your identity:
                        </p>
                        
                        <div style="background-color: #f0f4ff; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
                            <p style="margin: 0; font-size: 12px; color: #999;">Verification Code</p>
                            <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: 700; color: #1e40af; letter-spacing: 5px;">
                                ${otp}
                            </p>
                        </div>
                        
                        <p style="color: #666; font-size: 14px;">
                            This code will expire in <strong>10 minutes</strong>.
                        </p>
                        
                        <p style="color: #666; font-size: 14px;">
                            If you did not request this code, please ignore this email or contact our support team immediately.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            This is an automated message. Please do not reply to this email.
                        </p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("OTP email sent:", info.response);
        return true;
    } catch (error) {
        console.error("Error sending OTP email:", error);
        return false;
    }
}
