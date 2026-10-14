import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import logger from "./src/config/logger.config.js";

// Cron job imports
import { startLicenseExpiryCron } from "./src/cron/licenseExpiry.cron.js";
import { startLicenseActivationCron } from "./src/cron/licenseActivation.cron.js";
import { startLicenseExpiryReminderCron } from "./src/cron/licenseExpiryReminder.cron.js";
import { initializeRenewalCrons } from "./src/cron/renewal.cron.js";
import { startDailySummaryCron } from "./src/cron/dailySummary.cron.js";
import { startPendingTransactionCleanupCron } from "./src/cron/pendingTransactionCleanup.cron.js";

// 🔥 Resolve absolute path correctly (ESM-safe)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ LOAD .env from backend folder
dotenv.config({
  path: path.join(__dirname, ".env"),
});

if (!process.env.MICROSOFT_CLIENT_SECRET) {
  logger.error("MICROSOFT_CLIENT_SECRET is missing. Email service will not work.");
}

logger.info("Starting server", {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET ? "Loaded" : "Missing",
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET ? "Loaded" : "Missing",
});
import app from "./src/app.js";
import { connectDB } from "./src/config/db.config.js";

const PORT = process.env.PORT || 4000;

// Connect to database
connectDB();

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
  });
});

// ==========================================
// START ALL CRON JOBS
// ==========================================
logger.info("Initializing cron jobs");

try {
  // 1. License Expiry Cron (marks licenses as expired)
  startLicenseExpiryCron();
  logger.info("License Expiry Cron initialized");

  // 2. License Activation Cron (activates queued licenses)
  startLicenseActivationCron();
  logger.info("License Activation Cron initialized");

  // 3. License Expiry Reminder Cron (sends reminder emails)
  startLicenseExpiryReminderCron();
  logger.info("License Expiry Reminder Cron initialized");

  // 4. License Renewal Cron (checks for renew)
  initializeRenewalCrons();
  logger.info("Renewal Cron initialized");

  // 5. Daily Summary Cron (sends daily reports to admins)
  startDailySummaryCron();
  logger.info("Daily Summary Cron initialized");

  // 6. Pending Transaction Cleanup Cron (cancels abandoned checkouts)
  startPendingTransactionCleanupCron();
  logger.info("Pending Transaction Cleanup Cron initialized");
} catch (error) {
  logger.error("Error initializing cron jobs", { error: error.message });
}

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down', { error: err?.message, stack: err?.stack });
  server.close(() => {
    process.exit(1);
  });
});

export default server;
