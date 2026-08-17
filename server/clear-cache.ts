import "dotenv/config";
import { CacheService } from "./src/services/cache.service";

async function main() {
  const userId = "17f9cada-df50-4219-b2e6-d715b525b137";
  await CacheService.invalidateUser(userId);
  console.log("Redis cache cleared!");
}

main().catch(console.error).finally(() => process.exit(0));
