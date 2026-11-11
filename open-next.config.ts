import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Pages render on request or in the browser, so no incremental cache (R2/KV) is needed.
export default defineCloudflareConfig({});
