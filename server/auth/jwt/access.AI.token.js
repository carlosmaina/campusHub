import "dotenv/config";
import jwt from "jsonwebtoken";

// This sends the actual access token after successful login
export function AccessToken(req, res, next) {
    let token = jwt.sign({ 
        user: req.userAvail, 
        userId: req.User_id,
        role: req.User_role 
    }, process.env.ACCESS_TOKEN);
    res.status(200).json({ 
        message: req.isFirstLogin ? "Welcome! First login - email sent" : "User logged in", 
        email: req.User_email, 
        user: req.userAvail, 
        userId: req.User_id.toString(), // Send userId to client
        role: req.User_role, // Send user role to client
        isFirstLogin: req.isFirstLogin, // Indicate if this is first login
        token: token 
    });    
}

// Authentication middleware to verify JWT token
export function authenticate(req, res, nxt) {
    let authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json("Not logged in");
    let authToken = authHeader.split(" ")[1];
    jwt.verify(authToken, process.env.ACCESS_TOKEN, (err, decode) => {
        if (err) return res.status(401).json("Token expired");
        req.user = decode.user;
        nxt();
    })
}