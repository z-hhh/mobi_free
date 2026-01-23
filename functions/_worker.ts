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
    duration?: number;
    metricValue?: number;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Only handle /api/analytics - all other routes should NOT reach here
        // if run_worker_first is configured correctly
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

        // For any other request that reaches here, return 404
        // This shouldn't happen if assets are configured correctly
        return new Response("Not Found", { status: 404 });
    }
};
