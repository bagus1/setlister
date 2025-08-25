const { PrismaClient } = require("../generated/prisma");

// Environment-specific Prisma configuration
function getPrismaConfig() {
  const env = process.env.NODE_ENV || "local";

  switch (env) {
    case "local":
      return {
        log: ["query", "info", "warn", "error"],
        errorFormat: "pretty",
      };
    case "demo":
      return {
        log: ["error"],
        errorFormat: "pretty",
        // Demo environment has SSL disabled
        datasources: {
          db: {
            url:
              process.env.DATABASE_URL ||
              `postgresql://${process.env.DB_USER || "bagus1_setlists_app"}:${process.env.DB_PASSWORD || ""}@localhost:5432/${process.env.DB_NAME || "bagus1_setlists_demo"}?sslmode=disable`,
          },
        },
      };
    case "production":
      return {
        log: ["error"],
        errorFormat: "pretty",
        // Production environment will have .env with creds
        datasources: {
          db: {
            url:
              process.env.DATABASE_URL ||
              `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}?sslmode=require`,
          },
        },
      };
    default:
      return {
        log: ["error"],
        errorFormat: "pretty",
      };
  }
}

// Create a single PrismaClient instance that can be shared throughout the app
const prisma = new PrismaClient(getPrismaConfig());

// Handle graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Test the connection
async function testConnection() {
  try {
    await prisma.$connect();
    console.log(
      `✅ Prisma connected to database successfully in ${process.env.NODE_ENV || "local"} environment`
    );
  } catch (error) {
    console.error(
      `❌ Prisma failed to connect to database in ${process.env.NODE_ENV || "local"} environment:`,
      error
    );
    throw error;
  }
}

// Get current environment info
function getEnvironmentInfo() {
  return {
    NODE_ENV: process.env.NODE_ENV || "local",
    DATABASE_URL: process.env.DATABASE_URL ? "set" : "not set",
    DB_NAME: process.env.DB_NAME || "not set",
    DB_USER: process.env.DB_USER || "not set",
    DB_PASSWORD: process.env.DB_PASSWORD ? "set" : "not set",
  };
}

// Export the client and connection test
module.exports = {
  prisma,
  testConnection,
  getEnvironmentInfo,
};
