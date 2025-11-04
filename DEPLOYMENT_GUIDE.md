# DeFi Guardian - Complete Deployment Guide 🚀

## 🎯 Current Status

**✅ READY TO DEPLOY:**
- DeFi Guardian (client agent)
- 3/5 service agents with internal APIs

**🔧 NEEDS INTERNAL API (optional):**
- Perps Funding Pulse
- Cross DEX Arbitrage

## Step 1: Set API Key in Railway

You need to add the `INTERNAL_API_KEY` environment variable to ALL services.

### Generate Secure API Key

```bash
openssl rand -hex 32
```

**Example output:** `a7f3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1`

### Add to Railway Services

For EACH of these services in Railway:

1. **defi-guardian**
2. **yield-pool-watcher**
3. **lending-liquidation-sentinel**
4. **lp-impermanent-loss-estimator**
5. *(Optional)* **perps-funding-pulse**
6. *(Optional)* **cross-dex-arbitrage**

**Steps:**
1. Go to Railway dashboard
2. Click on service
3. Go to "Variables" tab
4. Click "New Variable"
5. Add:
   - Name: `INTERNAL_API_KEY`
   - Value: `<your-generated-key>`
6. Click "Add"
7. Service will auto-redeploy

**⚠️ IMPORTANT:** Use the SAME key for all services!

## Step 2: Deploy DeFi Guardian to Railway

### Option A: Via Railway Dashboard

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `DeganAI/defi-guardian`
5. Railway will auto-detect Bun and deploy
6. Add environment variables:
   - `INTERNAL_API_KEY` = your generated key
   - `PORT` = 3000
   - `BASE_URL` = (Railway will provide this after first deploy)

### Option B: Via Railway CLI

```bash
cd /Users/kellyborsuk/Documents/gas/p/defi-guardian
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set INTERNAL_API_KEY=<your-key>
```

## Step 3: Verify Internal APIs Work

Once Railway deploys, test each internal API:

### Test Yield Pool Watcher
```bash
curl -X POST https://yield-pool-watcher-production.up.railway.app/api/internal/yield-pool-watcher \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: YOUR_KEY_HERE" \
  -d '{
    "protocol_ids": ["aave-v3"],
    "chain_ids": [1],
    "apy_threshold": 10,
    "tvl_threshold": 0.2
  }'
```

**Expected:** 200 OK with pool data

### Test Lending Liquidation Sentinel
```bash
curl -X POST https://lending-liquidation-sentinel-production.up.railway.app/api/internal/lending-liquidation-sentinel \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: YOUR_KEY_HERE" \
  -d '{
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "chain_ids": [1],
    "protocols": ["aave", "compound"],
    "alert_threshold": 1.5
  }'
```

**Expected:** 200 OK with positions data

### Test LP Impermanent Loss Estimator
```bash
curl -X POST https://lp-impermanent-loss-estimator-production-62b5.up.railway.app/api/internal/lp-impermanent-loss-estimator \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: YOUR_KEY_HERE" \
  -d '{
    "initial_price_0": 100,
    "initial_price_1": 100,
    "current_price_ratio": 1.2,
    "amount_0": 1000,
    "amount_1": 1000,
    "fees_earned": 50,
    "days_held": 30
  }'
```

**Expected:** 200 OK with IL calculation

### Test Authentication (Should Fail)
```bash
curl -X POST https://yield-pool-watcher-production.up.railway.app/api/internal/yield-pool-watcher \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: wrong-key" \
  -d '{"protocol_ids": ["aave-v3"], "chain_ids": [1]}'
```

**Expected:** 401 Unauthorized

## Step 4: Test DeFi Guardian

Once DeFi Guardian is deployed:

```bash
curl -X POST https://defi-guardian-production.up.railway.app/entrypoints/defi-guardian/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "chain_ids": [1, 42161, 8453],
    "include_perps": false,
    "include_arbitrage": false
  }'
```

**Expected:** 402 Payment Required (x402 working!)

**With x402 Payment:**
1. Get payment token from x402 facilitator
2. Add `Authorization: Bearer <token>` header
3. Should return comprehensive DeFi analysis

## Step 5: Monitor Costs

### Before (x402 endpoints):
- Cost per call: $0.30
- Need to fund DeFi Guardian wallet

### After (Internal APIs):
- **Cost per call: $0.00** ✅
- **No funding needed** ✅
- **100% profit margin** ✅

### Check Logs
```bash
# In Railway dashboard, view logs for each service
# Should see: "🔓 Internal API: /api/internal/SERVICE-NAME (requires API key)"
```

## Step 6: Register on x402scan

1. Go to https://www.x402scan.com
2. Submit DeFi Guardian URL:
   - `https://defi-guardian-production.up.railway.app`
3. Agent will appear in marketplace
4. Users can discover and pay to use it

## Troubleshooting

### Issue: 401 Unauthorized on Internal API
**Fix:** Check `INTERNAL_API_KEY` matches in both client and service

### Issue: 502 Bad Gateway
**Fix:** Check Railway logs, service may still be deploying

### Issue: Can't find module error
**Fix:** Make sure `node_modules/` is in `.gitignore` and not committed

### Issue: x402 endpoint returns 500
**Fix:** Check public endpoint still works without API key header

## Complete Services Checklist

- [ ] DeFi Guardian deployed to Railway
- [ ] `INTERNAL_API_KEY` set on DeFi Guardian
- [ ] Yield Pool Watcher has `INTERNAL_API_KEY`
- [ ] Lending Liquidation Sentinel has `INTERNAL_API_KEY`
- [ ] LP Impermanent Loss Estimator has `INTERNAL_API_KEY`
- [ ] All internal APIs return 200 with correct key
- [ ] All internal APIs return 401 with wrong key
- [ ] DeFi Guardian returns 402 for public calls
- [ ] DeFi Guardian can call internal APIs successfully
- [ ] Registered on x402scan

## Optional: Add Internal APIs to Remaining Services

Follow the same pattern from `INTERNAL_API_GUIDE.md`:

### Perps Funding Pulse
1. `cd /Users/kellyborsuk/Documents/gas/files-2/perps-funding-pulse`
2. `bun install hono`
3. Add internal API endpoint (see guide)
4. Push to GitHub
5. Railway auto-deploys
6. Add `INTERNAL_API_KEY` env var

### Cross DEX Arbitrage
Same steps as Perps Funding Pulse

## Security Best Practices

✅ **DO:**
- Use cryptographically secure API key
- Rotate key periodically (every 90 days)
- Use environment variables (never hardcode)
- Monitor for unauthorized access attempts
- Keep internal API URLs private

❌ **DON'T:**
- Share API key in public docs
- Commit API key to git
- Use simple/guessable keys
- Reuse keys across projects

## Cost Savings Calculator

| Calls/Day | Old Cost | New Cost | Savings/Month |
|-----------|----------|----------|---------------|
| 10        | $3.00    | $0.00    | $90.00        |
| 50        | $15.00   | $0.00    | $450.00       |
| 100       | $30.00   | $0.00    | $900.00       |
| 500       | $150.00  | $0.00    | $4,500.00     |
| 1000      | $300.00  | $0.00    | $9,000.00     |

**Annual savings at 100 calls/day: $10,800** 🎉

## Next Steps

1. ✅ Deploy all services to Railway
2. ✅ Set API keys
3. ✅ Test internal APIs
4. ✅ Register on x402scan
5. 🚀 Start earning with 100% profit margin!

---

Built by degenllama.net 🚀

**Questions?** Check the logs, review INTERNAL_API_GUIDE.md, or test each endpoint individually.
