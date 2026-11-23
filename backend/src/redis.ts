import IORedis from "ioredis";
import { config } from "./config";

export const redis = new IORedis({
  host: config.redisHost,
  port: config.redisPort,
  maxRetriesPerRequest: null
});