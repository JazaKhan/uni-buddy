import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
	url: process.env.UPSTASH_REDIS_REST_URL!,
	token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const ratelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(60, "1 m"),
	analytics: true,
});

export const aiRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(10, "1 m"),
	analytics: true,
});

export async function checkRateLimit(
	userId: string,
	tier: "ai" | "general" = "general",
): Promise<boolean> {
	try {
		const limiter = tier === "ai" ? aiRatelimit : ratelimit;
		const { success } = await limiter.limit(userId);
		return success;
	} catch {
		return true;
	}
}
