import mongoose from "mongoose";
// create model function
async function sign_model(req, res, nxt) {
    const { data } = req.body;
    // destructuring data with role
    const { username, email, password, role = "student" } = data;
    // creating schema with role field
    let sign_schema = new mongoose.Schema({ 
        user: String, 
        email: String, 
        password: String,
        role: { type: String, enum: ["student", "lecturer"], default: "student" },
        firstLogin: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
    });
    // creating model
    let sign_model = mongoose.models.users || mongoose.model("users", sign_schema);
    // checking if user already exists
    let user_exists = await sign_model.findOne({ $or: [{ email: email }, { user: username }] })
    // if user exists
    if (user_exists) { return res.status(400).json("user already exists") }
    // creating new user with role
    sign_model.create({ user: username, password: password, email: email, role: role, firstLogin: true })
    nxt()
};
export default sign_model;