import { readFileSync } from "fs";
import { resolve } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(__dirname, ".env") });

// Prisma 7 requires explicit config file for db push
export default {
  datasource: {
    url: process.env.DATABASE_URL
  }
};
