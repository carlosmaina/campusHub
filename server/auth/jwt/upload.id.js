import { generateAutoId } from "./auto.id.js";

export function archive(req, res, next) {
  // Attach the ID to the request body
  req.body.userId = generateAutoId();
  next();
}
