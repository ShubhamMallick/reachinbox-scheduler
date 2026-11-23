import { redis } from "./redis";

const reserveScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local current = tonumber(redis.call("GET", key) or "0")

if current >= limit then
  return 0
end

redis.call("INCR", key)
redis.call("EXPIRE", key, ttl)
return 1
`;

export async function reserveHourlySlot(
  senderKey: string,
  hourlyLimit: number
): Promise<boolean> {
  const hourWindow = Math.floor(Date.now() / 3_600_000);
  const key = `email-limit:${senderKey}:${hourWindow}`;

  const result = await redis.eval(
    reserveScript,
    1,
    key,
    hourlyLimit,
    7200
  );

  return Number(result) === 1;
}