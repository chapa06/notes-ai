import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET, OBJECT_ID_REGEX } from "../config";
import { AuthenticatedRequest, JwtPayload } from "../types";

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.sendStatus(401);
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: unknown, decoded: unknown) => {
    if (err) {
      res.sendStatus(403);
      return;
    }

    const user = decoded as JwtPayload;

    if (!user.id || !OBJECT_ID_REGEX.test(user.id)) {
      res.status(401).json({ error: "Invalid token format. Please re-login." });
      return;
    }

    req.user = user;
    next();
  });
}