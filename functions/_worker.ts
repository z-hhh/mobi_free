import { AnalyticsEngineDataset } from '@cloudflare/workers-types';

interface Env {
    ANALYTICS: AnalyticsEngineDataset;
}

interface AnalyticsPayload {
    type: string;
    version: string;
    userAgent?: string;
    errorDetails?: string;
    deviceName?: string;
    protocol?: string;
    isBluefy?: boolean;
    duration?: number;
    metricValue?: number;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Only handle /api/analytics
        if (url.pathname === '/api/analytics' && request.method === 'POST') {
            try {
                const data = await request.json() as AnalyticsPayload;

                if (!data.type || !data.version) {
                    return new Response("Missing required fields: type, version", { status: 400 });
                }

                if (!env?.ANALYTICS) {
                    return new Response("ANALYTICS binding not configured", { status: 500 });
                }

                const point = {
                    indexes: [data.type],
                    blobs: [
                        data.version,
                        data.userAgent || request.headers.get("User-Agent") || "",
                        data.errorDetails || "",
                        data.deviceName || "",
                        data.protocol || "",
                        data.isBluefy !== undefined ? String(data.isBluefy) : "",
                    ],
                    doubles: [
                        data.duration || 0,
                        data.metricValue || 0,
                    ],
                };

                console.log("DEBUG: Writing data point:", JSON.stringify(point));
                env.ANALYTICS.writeDataPoint(point);
                console.log("DEBUG: writeDataPoint called successfully");

                return new Response("OK", { status: 200 });
            } catch (err) {
                const error = err as Error;
                console.error("ERROR:", error.message, error.stack);
                return new Response(`Error: ${error.message}`, { status: 500 });
            }
        }

        return new Response("Not Found", { status: 404 });
    }
};
