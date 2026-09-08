/**
 * sample-app/src/app.ts
 *
 * This file contains INTENTIONAL security vulnerabilities to demonstrate
 * what the DevSecOps pipeline catches.
 *
 * DO NOT use any of these patterns in production code.
 * Each vulnerability is labelled with the Semgrep rule that catches it.
 */

import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";

// ─────────────────────────────────────────────────────────
// ❌ BAD: Hardcoded JWT secret (caught by: hardcoded-jwt-secret)
// ─────────────────────────────────────────────────────────
export function createTokenBad(userId: string): string {
  return jwt.sign({ userId }, "mysupersecretkey"); // ← SAST will flag this
}

// ✅ GOOD: Secret from environment variable
export function createTokenGood(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.sign({ userId }, secret, { expiresIn: "15m" });
}

// ─────────────────────────────────────────────────────────
// ❌ BAD: SQL injection via string concatenation
// (caught by: sql-string-concat)
// ─────────────────────────────────────────────────────────
export function getUserBad(db: any, userId: string): Promise<any> {
  const query = `SELECT * FROM users WHERE id = '${userId}'`; // ← SAST will flag this
  return db.query(query);
}

// ✅ GOOD: Parameterised query
export function getUserGood(db: any, userId: string): Promise<any> {
  return db.query("SELECT * FROM users WHERE id = $1", [userId]);
}

// ─────────────────────────────────────────────────────────
// ❌ BAD: Insecure random for token generation
// (caught by: insecure-random-security)
// ─────────────────────────────────────────────────────────
export function generateTokenBad(): string {
  return Math.random().toString(36).slice(2); // ← SAST will flag this
}

// ✅ GOOD: Cryptographically secure random
export function generateTokenGood(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ─────────────────────────────────────────────────────────
// ❌ BAD: eval() usage
// (caught by: dangerous-eval)
// ─────────────────────────────────────────────────────────
export function evaluateExpressionBad(userInput: string): any {
  return eval(userInput); // ← SAST will flag this
}

// ✅ GOOD: Parse and validate input instead
export function parseNumberGood(userInput: string): number {
  const num = parseFloat(userInput);
  if (isNaN(num)) throw new Error("Invalid number");
  return num;
}

// ─────────────────────────────────────────────────────────
// ❌ BAD: Logging sensitive data
// (caught by: log-sensitive-data)
// ─────────────────────────────────────────────────────────
export function loginBad(user: any): void {
  console.log("User login:", user.password); // ← SAST will flag this
}

// ✅ GOOD: Log only safe fields
export function loginGood(user: any): void {
  console.log("User login:", { id: user.id, email: user.email });
}
