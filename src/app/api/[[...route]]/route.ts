import { Redis } from "@upstash/redis/cloudflare";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";

// this is just to deploy the api to the edge using vercel...
export const runtime = "edge";

type EnvConfig = {
	UPSTASH_REDIS_TOKEN: string;
	UPSTASH_REDIS_URL: string;
};

const app = new Hono();

app.use('/*', cors());

app.get("/", (c) => {
	return c.json({ message: "SpeedSearch API 🚀" });
})

app.get("/api/search", async (c) => {
	try {
		const { UPSTASH_REDIS_TOKEN, UPSTASH_REDIS_URL } = env<EnvConfig>(c);

		// ------------
		const start = performance.now();

		const redis = new Redis({
			url: UPSTASH_REDIS_URL,
			token: UPSTASH_REDIS_TOKEN,
		});

		const query = c.req.query("q")?.toUpperCase();

		if (!query) {
			return c.json({ message: "invalid search query..." }, { status: 400 });
		}

		const res = [];
		const rank = await redis.zrank("terms", query);

		if (rank !== null && rank !== undefined) {
			const temp = await redis.zrange<string[]>("terms", rank, rank + 50);

			for (const e of temp) {
				if (!e.startsWith(query)) {
					break;
				}

				if (e.endsWith("*")) {
					res.push(e.substring(0, e.length - 1));
				}
			}
		}

		// -------------
		const end = performance.now();

		return c.json({
			results: res,
			duration: end - start,
		});
	} catch (err) {
		console.log(err);

		return c.json(
			{ results: [], message: "something went wrong..." },
			{ status: 500 },
		);
	}
});

// again below is for deploying the api to the edge using vercel...
export const GET = handle(app);
export default app;
