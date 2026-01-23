import { AnalyticsEngineDataset, Fetcher } from '@cloudflare/workers-types';

interface Env {
    ANALYTICS: AnalyticsEngineDataset;
    ASSETS: Fetcher;
}

interface AnalyticsPayload {
    type: string;
    version: string;
    userAgent?: string;
    errorDetails?: string;
    deviceName?: string;
    duration?: number;
    metricValue?: number;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // API Route: /api/analytics
        if (url.pathname === '/api/analytics' && request.method === 'POST') {
            try {
                const data = await request.json() as AnalyticsPayload;

                if (!data.type || !data.version) {
                    return new Response("Missing required fields: type, version", { status: 400 });
                }

                env.ANALYTICS.writeDataPoint({
                    indexes: [data.version, data.type],
                    blobs: [
                        data.userAgent || request.headers.get("User-Agent") || "Unknown",
                        data.errorDetails || "",
                        data.deviceName || "",
                    ],
                    doubles: [
                        data.duration || 0,
                        data.metricValue || 0,
                    ],
                });

                return new Response("OK", { status: 200 });
            } catch {
                return new Response("Error processing analytics", { status: 500 });
            }
        }

        // Fallback: Serve Static Assets
        return env.ASSETS.fetch(request as unknown as Parameters<typeof env.ASSETS.fetch>[0]) as unknown as Promise<Response>;
    }
};
