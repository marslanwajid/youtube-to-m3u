import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  // If no password is set, authentication is disabled (always authenticated)
  if (!adminPassword) {
    return res.status(200).json({ authenticated: true, disabled: true });
  }

  const expectedToken = crypto
    .createHash("sha256")
    .update(adminPassword)
    .digest("hex");

  if (req.method === "POST") {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    if (password === adminPassword) {
      // Set session cookie manually without external libraries
      const isProd = process.env.NODE_ENV === "production";
      const cookieStr = `admin_session=${expectedToken}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Strict${isProd ? '; Secure' : ''}`;
      res.setHeader("Set-Cookie", cookieStr);
      return res.status(200).json({ success: true });
    } else {
      return res.status(401).json({ error: "Invalid password" });
    }
  } else if (req.method === "GET") {
    const cookies = req.cookies;
    const sessionToken = cookies.admin_session;

    if (sessionToken === expectedToken) {
      return res.status(200).json({ authenticated: true });
    } else {
      return res.status(200).json({ authenticated: false });
    }
  } else if (req.method === "DELETE") {
    // Logout by clearing the cookie
    const isProd = process.env.NODE_ENV === "production";
    const cookieStr = `admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${isProd ? '; Secure' : ''}`;
    res.setHeader("Set-Cookie", cookieStr);
    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
