import { readFileSync } from "fs";
import { resolve } from "path";

// Prisma 7 requires explicit config file for db push
export default {
  datasource: {
    url: process.env.DATABASE_URL
  }
};
