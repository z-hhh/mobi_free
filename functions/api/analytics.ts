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

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const data = await context.request.json() as AnalyticsPayload;

        // Basic validation
        if (!data.type || !data.version) {
            return new Response("Missing required fields: type, version", { status: 400 });
        }

        const point = {
            indexes: [data.version, data.type], // For filtering/grouping
            blobs: [
                data.userAgent || context.request.headers.get("User-Agent") || "Unknown", // standard blob 1
                data.errorDetails || "", // standard blob 2
                data.deviceName || "",   // standard blob 3
            ],
            doubles: [
                data.duration || 0,      // standard double 1
                data.metricValue || 0,   // standard double 2
            ],
        };

        context.env.ANALYTICS.writeDataPoint(point);

        return new Response("OK", { status: 200 });
    } catch (err) {
        return new Response("Error processing analytics", { status: 500 });
    }
}
