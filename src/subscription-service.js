const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const AUTH_CLAIM_NAMESPACE = "https://api.openai.com/auth";
const MAX_AUTH_FILE_BYTES = 1024 * 1024;
const MAX_JWT_PAYLOAD_BYTES = 256 * 1024;
const KNOWN_PLAN_TYPES = new Set([
  "free",
  "go",
  "plus",
  "pro",
  "prolite",
  "team",
  "self_serve_business_usage_based",
  "business",
  "enterprise_cbp_usage_based",
  "enterprise",
  "edu",
  "unknown"
]);
const NON_SUBSCRIPTION_PLANS = new Set(["free", "unknown"]);

function normalizePlanType(value) {
  const planType = String(value || "").trim().toLowerCase();
  return KNOWN_PLAN_TYPES.has(planType) ? planType : "unknown";
}

function parseTimestamp(value) {
  if (typeof value === "string" && value.trim()) {
    const milliseconds = Date.parse(value);
    return Number.isFinite(milliseconds) && milliseconds >= 0
      ? Math.floor(milliseconds / 1000)
      : null;
  }
  if (!Number.isFinite(value) || value < 0) return null;
  const seconds = value > 10_000_000_000 ? value / 1000 : value;
  return Math.floor(seconds);
}

function decodeJwtPayload(token) {
  if (typeof token !== "string" || token.length > MAX_AUTH_FILE_BYTES) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payloadBuffer = Buffer.from(parts[1], "base64url");
    if (!payloadBuffer.length || payloadBuffer.length > MAX_JWT_PAYLOAD_BYTES) return null;
    const payload = JSON.parse(payloadBuffer.toString("utf8"));
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : null;
  } catch {
    return null;
  }
}

function extractSubscriptionClaims(authDocument) {
  if (!authDocument || typeof authDocument !== "object") return null;
  if (String(authDocument.auth_mode || "").toLowerCase() !== "chatgpt") return null;
  const payload = decodeJwtPayload(authDocument.tokens?.id_token);
  const claims = payload?.[AUTH_CLAIM_NAMESPACE];
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) return null;

  const activeStart = parseTimestamp(claims.chatgpt_subscription_active_start);
  const activeUntil = parseTimestamp(claims.chatgpt_subscription_active_until);
  const lastCheckedAt = parseTimestamp(claims.chatgpt_subscription_last_checked);
  const planType = normalizePlanType(claims.chatgpt_plan_type);
  if (
    planType === "unknown" &&
    activeStart === null &&
    activeUntil === null &&
    lastCheckedAt === null
  ) return null;

  return { planType, activeStart, activeUntil, lastCheckedAt };
}

function daysInUtcMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addUtcMonths(timestamp, months) {
  const date = new Date(timestamp * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(Math.min(day, daysInUtcMonth(date.getUTCFullYear(), date.getUTCMonth())));
  return Math.floor(date.getTime() / 1000);
}

function detectBillingIntervalMonths(activeStart, activeUntil) {
  if (!Number.isFinite(activeStart) || !Number.isFinite(activeUntil) || activeUntil <= activeStart) {
    return 1;
  }
  const toleranceSeconds = 3 * 24 * 60 * 60;
  for (let months = 1; months <= 12; months += 1) {
    const candidate = addUtcMonths(activeStart, months);
    if (Number.isFinite(candidate) && Math.abs(candidate - activeUntil) <= toleranceSeconds) {
      return months;
    }
  }
  return 1;
}

function resolveRenewalAt(activeStart, activeUntil, planType, nowSeconds) {
  if (!Number.isFinite(activeUntil)) return { renewalAt: null, projected: false };
  if (activeUntil > nowSeconds) return { renewalAt: activeUntil, projected: false };
  if (NON_SUBSCRIPTION_PLANS.has(normalizePlanType(planType))) {
    return { renewalAt: activeUntil, projected: false };
  }

  const intervalMonths = detectBillingIntervalMonths(activeStart, activeUntil);
  let renewalAt = activeUntil;
  for (let index = 0; index < 120 && renewalAt <= nowSeconds; index += 1) {
    const next = addUtcMonths(renewalAt, intervalMonths);
    if (!Number.isFinite(next) || next <= renewalAt) break;
    renewalAt = next;
  }
  return {
    renewalAt,
    projected: renewalAt !== activeUntil
  };
}

function normalizeSubscriptionDetails(
  raw,
  { planType, totalWorkDays } = {},
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const normalizedPlan = normalizePlanType(planType || raw?.planType);
  const activeStart = parseTimestamp(raw?.activeStart);
  const activeUntil = parseTimestamp(raw?.activeUntil);
  const lastCheckedAt = parseTimestamp(raw?.lastCheckedAt);
  const assistedWorkDays = Number.isFinite(totalWorkDays) && totalWorkDays >= 0
    ? Math.floor(totalWorkDays)
    : null;
  const renewal = resolveRenewalAt(activeStart, activeUntil, normalizedPlan, nowSeconds);

  return {
    available: !NON_SUBSCRIPTION_PLANS.has(normalizedPlan),
    planType: normalizedPlan,
    assistedWorkDays,
    activeStart,
    expiresAt: renewal.renewalAt,
    renewalAt: renewal.renewalAt,
    projected: renewal.projected,
    sourceCheckedAt: lastCheckedAt
  };
}

class CodexSubscriptionReader {
  constructor({ authPath } = {}) {
    const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
    this.authPath = authPath || path.join(codexHome, "auth.json");
  }

  read() {
    try {
      const stats = fs.statSync(this.authPath);
      if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_AUTH_FILE_BYTES) return null;
      const authDocument = JSON.parse(fs.readFileSync(this.authPath, "utf8"));
      return extractSubscriptionClaims(authDocument);
    } catch {
      return null;
    }
  }
}

module.exports = {
  AUTH_CLAIM_NAMESPACE,
  CodexSubscriptionReader,
  addUtcMonths,
  decodeJwtPayload,
  extractSubscriptionClaims,
  normalizePlanType,
  normalizeSubscriptionDetails,
  parseTimestamp,
  resolveRenewalAt
};
