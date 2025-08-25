require("dotenv").config();

module.exports = {
  development: {
    dialect: "sqlite",
    storage: "./database.sqlite",
    logging: false,
  },
  development_postgres: {
    dialect: "postgres",
    host: "localhost",
    port: 5432,
    database: "setlists_dev",
    username: "setlists_dev",
    password: "", // No password for local dev
    logging: console.log, // Enable SQL logging for debugging
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
  test: {
    dialect: "postgres",
    host: "localhost",
    port: 5432,
    database: "setlists_test",
    username: "setlists_dev",
    password: "",
    logging: false,
  },
  demo: {
    dialect: "postgres",
    host: "localhost",
    port: 5432,
    database: "bagus1_setlists_demo",
    username: "bagus1_setlists_app",
    password: process.env.DB_PASSWORD || "",
    logging: false,
    dialectOptions: {
      ssl: false,
    },
    native: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
  production: {
    dialect: "postgres",
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
  },
};

// Default to PostgreSQL for development
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development_postgres";
}
