# Zero-Cost Internal API Strategy 🎯

## Overview

This guide shows how to make your service agents **completely free** for your own DeFi Guardian client, resulting in **100% profit margin** ($0.75 pure profit per call instead of ~$0.30).

## The Problem

Original architecture had backend costs:
- Lending Liquidation Sentinel: $0.06
- LP Impermanent Loss Estimator: $0.04
- Yield Pool Watcher: $0.05
- Perps Funding Pulse: $0.05
- Cross DEX Arbitrage: $0.10

**Total cost per call: $0.30**
**Charge: $0.75**
**Profit: $0.45 (60%)**

## The Solution

Add **internal API endpoints** that bypass x402 payments:

### Architecture

```
External Users → x402 endpoint → Pay $0.05 → Get data ✅
DeFi Guardian → Internal API → API key auth → Get data FREE ✅
```

### Benefits

✅ **Zero Backend Costs** - No payment for internal calls
✅ **100% Profit Margin** - Keep entire $0.75 per call
✅ **Public Services Intact** - x402 endpoints still work
✅ **Simple Authentication** - Shared API key
✅ **Same Logic** - Internal APIs call same functions

## Implementation

### Step 1: Add Hono to Service Agents

```bash
bun install hono
```

### Step 2: Add Internal API Endpoint

Add this pattern to each service agent:

```typescript
import { Hono } from "hono";

// ... existing agent-kit setup ...

// Create wrapper app for internal API
const wrapperApp = new Hono();

// Internal API endpoint (no payment required)
wrapperApp.post("/api/internal/SERVICE-NAME", async (c) => {
  try {
    // Check API key authentication
    const apiKey = c.req.header("X-Internal-API-Key");
    const expectedKey = process.env.INTERNAL_API_KEY || "defi-guardian-internal-2024";

    if (apiKey !== expectedKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get input from request body
    const input = await c.req.json();

    // Validate input
    const validatedInput = InputSchema.parse(input);

    // Call the same logic as x402 endpoint
    const result = await yourServiceLogic(validatedInput);

    return c.json(result);
  } catch (error) {
    console.error("[INTERNAL API] Error:", error);
    return c.json({
      error: error instanceof Error ? error.message : "Internal error"
    }, 500);
  }
});

// Mount the x402 agent app (public, requires payment)
wrapperApp.route("/", app);

// Export wrapper instead of agent app
export default {
  port: parseInt(process.env.PORT || "3000"),
  fetch: wrapperApp.fetch,
};
```

### Step 3: Update Service Agents

Apply this pattern to all 5 agents:

#### ✅ Yield Pool Watcher
- Endpoint: `/api/internal/yield-pool-watcher`
- Status: **IMPLEMENTED**

#### 🔄 Lending Liquidation Sentinel
- Endpoint: `/api/internal/lending-liquidation-sentinel`
- TODO: Add internal API

#### 🔄 LP Impermanent Loss Estimator
- Endpoint: `/api/internal/lp-impermanent-loss-estimator`
- TODO: Add internal API

#### 🔄 Perps Funding Pulse
- Endpoint: `/api/internal/perps-funding-pulse`
- TODO: Add internal API

#### 🔄 Cross DEX Arbitrage
- Endpoint: `/api/internal/cross-dex-arbitrage`
- TODO: Add internal API

### Step 4: Update DeFi Guardian

```typescript
// Internal API endpoints (zero cost - requires API key)
const INTERNAL_SERVICES = {
  lending: "https://lending-liquidation-sentinel-production.up.railway.app/api/internal/lending-liquidation-sentinel",
  yield: "https://yield-pool-watcher-production.up.railway.app/api/internal/yield-pool-watcher",
  lp: "https://lp-impermanent-loss-estimator-production-62b5.up.railway.app/api/internal/lp-impermanent-loss-estimator",
  perps: "https://perps-funding-pulse-production.up.railway.app/api/internal/perps-funding-pulse",
  arbitrage: "https://cross-dex-arbitrage-production.up.railway.app/api/internal/cross-dex-arbitrage",
};

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "defi-guardian-internal-2024";

async function callInternalService(url: string, payload: any): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-API-Key": INTERNAL_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`[INTERNAL] ${url} returned ${response.status}`);
    return null;
  }

  return await response.json();
}
```

### Step 5: Set Environment Variables

In Railway, add this to **ALL services**:

```env
INTERNAL_API_KEY=your-secure-random-key-here
```

**Generate a secure key:**
```bash
openssl rand -hex 32
```

## Security Considerations

### ✅ API Key Protection
- Use environment variables (never hardcode)
- Generate cryptographically secure keys
- Rotate keys periodically

### ✅ Internal Use Only
- Only DeFi Guardian should know the key
- Never expose in public docs
- Monitor usage for abuse

### ✅ Rate Limiting (Optional)
```typescript
const rateLimiter = new Map<string, number>();

wrapperApp.use(async (c, next) => {
  const key = c.req.header("X-Internal-API-Key");
  const count = rateLimiter.get(key) || 0;

  if (count > 1000) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  rateLimiter.set(key, count + 1);
  await next();
});
```

## Testing Internal APIs

### Test Yield Pool Watcher
```bash
curl -X POST https://yield-pool-watcher-production.up.railway.app/api/internal/yield-pool-watcher \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: defi-guardian-internal-2024" \
  -d '{
    "protocol_ids": ["aave-v3"],
    "chain_ids": [1],
    "apy_threshold": 10,
    "tvl_threshold": 0.2
  }'
```

### Expected Response
```json
{
  "pools": [...],
  "alerts_count": 0,
  "timestamp": "2025-11-03T..."
}
```

### Test Authentication
```bash
# Should return 401 Unauthorized
curl -X POST https://yield-pool-watcher-production.up.railway.app/api/internal/yield-pool-watcher \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: wrong-key" \
  -d '{"protocol_ids": ["aave-v3"], "chain_ids": [1]}'
```

## Updated Economics

### Before (x402 endpoints)
- Backend cost: $0.30
- Charge: $0.75
- **Profit: $0.45 (60%)**

### After (Internal APIs)
- Backend cost: **$0.00**
- Charge: $0.75
- **Profit: $0.75 (100%)**

### Revenue Projections

| Calls/Day | Daily Profit | Monthly Profit | Annual Profit |
|-----------|--------------|----------------|---------------|
| 10        | $7.50        | $225           | $2,738        |
| 50        | $37.50       | $1,125         | $13,688       |
| 100       | $75.00       | $2,250         | $27,375       |
| 500       | $375.00      | $11,250        | $136,875      |
| 1000      | $750.00      | $22,500        | $273,750      |

**No funding required** - DeFi Guardian doesn't need USDC balance!

## Deployment Checklist

- [x] Add Hono to service agents
- [x] Implement internal API in Yield Pool Watcher
- [ ] Implement internal API in Lending Liquidation Sentinel
- [ ] Implement internal API in LP Impermanent Loss Estimator
- [ ] Implement internal API in Perps Funding Pulse
- [ ] Implement internal API in Cross DEX Arbitrage
- [x] Update DeFi Guardian to use internal endpoints
- [ ] Set INTERNAL_API_KEY in all Railway services
- [ ] Test all internal endpoints
- [ ] Deploy and verify zero costs

## Next Steps

1. **Complete Implementation** - Add internal APIs to remaining 4 services
2. **Generate Secure Key** - Use `openssl rand -hex 32`
3. **Update Railway Env Vars** - Set INTERNAL_API_KEY in all services
4. **Test Thoroughly** - Verify internal APIs work and auth is enforced
5. **Deploy DeFi Guardian** - No funding needed!
6. **Monitor Usage** - Track profit metrics

## Monitoring

Track these metrics:
- **Internal API calls** - Count requests to internal endpoints
- **Cost savings** - Calculate avoided x402 payments
- **Profit margin** - Monitor 100% profit per call
- **Failed auth attempts** - Alert on suspicious activity

## Alternative: Direct Function Imports

For even better performance, you could:

1. Package service logic as npm modules
2. Import directly into DeFi Guardian
3. Call functions in-process (no HTTP overhead)

**Trade-offs:**
- ✅ Fastest possible
- ✅ No network latency
- ❌ Couples services together
- ❌ Harder to update independently

## Conclusion

By adding internal API endpoints, you've eliminated all backend costs while keeping services publicly available. This is the optimal architecture for service arbitrage.

**Key Insight:** When you own both client and services, use internal APIs to maximize profit!

---

Built by degenllama.net 🚀
