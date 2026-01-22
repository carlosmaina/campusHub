import {v4 as uuidv4} from "uuid";
import { OAuth2Client } from "google-auth-library";

export function generateAutoId() {
    return uuidv4();
}
// Initialize Google OAuth2 Client
export const oauth2client = new OAuth2Client(
    process.env.REACT_APP_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID"
);
