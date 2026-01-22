import mongoose, { Schema } from "mongoose";
import { sendWelcomeEmail } from "../email/nodemailer.config.js";

// creating model
async function login_model(req, res, nxt) {
    // destructuring data
    const { data } = req.body;
    // destructuring data
    const { email, password } = data;
    // creating schema with role field
    let user_login_schema = new Schema({ 
        user: String, 
        email: String, 
        password: String,
        role: { type: String, enum: ["student", "lecturer"], default: "student" },
        firstLogin: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
    });
    //    creating model
    let login_user = mongoose.models.users || mongoose.model("users", user_login_schema);
    // finding user
    const find_user = await login_user.findOne({ $or: [{ email: email }, { user: email }] });
    // if user doesn't exist
    if (!find_user) {
        return res.status(400).json("User doesn't exist");
    }
    if (find_user.password !== password) { return res.status(400).json("Invalid password") };
    
    // Check if this is first login
    const isFirstLogin = find_user.firstLogin !== false;
    
    // If first login, send welcome email and update firstLogin flag
    if (isFirstLogin) {
        await sendWelcomeEmail(find_user.email, find_user.user);
        
        // Also create a notification in the database
        try {
            const response = await fetch("http://localhost:8000/create-notification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: find_user._id.toString(),
                    title: "Welcome to CampusHub! 🎓",
                    message: "Welcome! Your account is now active. You can now upload PDFs, generate summaries, and access course resources.",
                    type: "welcome"
                })
            });
            if (!response.ok) {
                console.error("Failed to create welcome notification");
            }
        } catch (err) {
            console.error("Error creating notification:", err);
        }
        
        // Update firstLogin flag to false
        await login_user.findByIdAndUpdate(find_user._id, { firstLogin: false });
    }
    
    req.userAvail = find_user.user;
    req.User_email = find_user.email || null;
    req.User_id = find_user._id; // Store MongoDB user ID
    req.User_role = find_user.role || "student"; // Store user role
    req.isFirstLogin = isFirstLogin; // Pass first login flag for response
    nxt();
}
export default login_model;