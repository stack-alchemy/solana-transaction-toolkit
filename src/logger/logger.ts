import winston from "winston";
import "winston-daily-rotate-file"; // Import the daily rotate file transport

// Define the daily rotation configuration for logs
const dailyRotateTransport = new winston.transports.DailyRotateFile({
  filename: "logs/%DATE%.log", // Logs will be saved as 'logs/YYYY-MM-DD-app.log'
  datePattern: "YYYY-MM-DD", // Date format for filenames
  zippedArchive: false, // Disable log file compression (set to `true` to compress logs)
});

// Create the logger instance
export const logger = winston.createLogger({
  level: "info", // Set the default log level
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Timestamp in logs
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`; // Log format
    })
  ),
  transports: [
    // Log to console (useful in development)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
      ),
    }),
    // Log to a file with daily rotation
    dailyRotateTransport,
  ],
});
