# DeFi Guardian 🛡️

**Comprehensive DeFi risk analysis powered by 10 specialized agents**

DeFi Guardian is an x402-enabled client agent that provides complete portfolio health monitoring by aggregating data from multiple specialized DeFi analytics agents. Get instant insights into lending positions, yield pools, LP impermanent loss, perpetuals funding, and arbitrage opportunities - all in one call.

## Features

✅ **Lending Risk Analysis** - Monitor Aave V3 and Compound V3 positions across multiple chains
✅ **Yield Pool Tracking** - Track APY and TVL changes across top DeFi protocols
✅ **Impermanent Loss Estimation** - Calculate IL and fee APR for LP positions
✅ **Perpetuals Funding** - Real-time funding rates from major exchanges (optional)
✅ **Arbitrage Opportunities** - Cross-DEX price discrepancies (optional)
✅ **Risk Scoring** - 0-100 risk score with actionable recommendations
✅ **Critical Alerts** - Immediate warnings for liquidation risks

## Pricing

**Flat Rate: $0.75 per analysis** (paid in USDC on Base)

- No subscriptions
- Pay per use
- Comprehensive multi-agent analysis
- 67% profit margin built-in

## How It Works

DeFi Guardian orchestrates calls to 10 specialized service agents:

1. **Lending Liquidation Sentinel** ($0.06) - Health factor monitoring
2. **LP Impermanent Loss Estimator** ($0.04) - IL calculations
3. **Yield Pool Watcher** ($0.05) - APY/TVL tracking
4. **Perps Funding Pulse** ($0.05) - Funding rate analysis
5. **Cross DEX Arbitrage** ($0.10) - Arbitrage detection

Total backend cost: ~$0.30
Charge: $0.75
**Profit per call: $0.45 (150% markup)**

## API Usage

### Endpoint
```
POST https://defi-guardian-production.up.railway.app/entrypoints/defi-guardian/invoke
```

### Input Schema
```json
{
  "wallet_address": "0x...",
  "chain_ids": [1, 42161, 8453],
  "include_perps": false,
  "include_arbitrage": false
}
```

### Output Schema
```json
{
  "wallet_address": "0x...",
  "overall_risk_score": 45,
  "total_positions": 3,
  "critical_alerts": ["⚠️ Aave V3 on chain 1: Health factor 1.15"],
  "lending_analysis": { ... },
  "yield_analysis": { ... },
  "lp_analysis": { ... },
  "summary": "⚠️ HIGH risk detected...",
  "timestamp": "2025-11-03T..."
}
```

### Example Request with x402 Payment
```bash
curl -X POST https://defi-guardian-production.up.railway.app/entrypoints/defi-guardian/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <x402-token>" \
  -d '{
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "chain_ids": [1, 42161, 8453],
    "include_perps": false,
    "include_arbitrage": false
  }'
```

## Local Development

```bash
# Install dependencies
bun install

# Run locally
bun run dev

# Production build
bun run start
```

## Environment Variables

```env
PORT=3000
BASE_URL=https://defi-guardian-production.up.railway.app
NODE_ENV=production
```

## Deployment

### Railway
1. Connect GitHub repo to Railway
2. Set environment variables
3. Deploy automatically on push

### Environment Configuration
- **Network**: Base (8453)
- **Payment Asset**: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- **Payment Address**: 0x01D11F7e1a46AbFC6092d7be484895D2d505095c

## Revenue Model

DeFi Guardian demonstrates the **service arbitrage** model:

1. **Backend Services**: You own all 10 service agents
2. **Cost**: ~$0.30-$0.45 per full analysis
3. **Price**: $0.75 flat rate
4. **Margin**: $0.30-$0.45 profit (67-150%)

This guarantees profitability because you control both client and services.

## Architecture

```
User Request ($0.75)
    ↓
DeFi Guardian (Client Agent)
    ↓
    ├─→ Lending Liquidation Sentinel ($0.06)
    ├─→ LP Impermanent Loss Estimator ($0.04)
    ├─→ Yield Pool Watcher ($0.05)
    ├─→ Perps Funding Pulse ($0.05) [optional]
    └─→ Cross DEX Arbitrage ($0.10) [optional]
    ↓
Aggregated Response
```

## Supported Chains

- Ethereum (1)
- Arbitrum (42161)
- Base (8453)
- Optimism (10)
- Polygon (137)

## Supported Protocols

- Aave V3
- Compound V3
- Uniswap V3
- Binance (perps)
- Bybit (perps)
- OKX (perps)
- Hyperliquid (perps)

## Future Enhancements

- [ ] Real-time position tracking
- [ ] WebSocket alerts
- [ ] Telegram/Discord notifications
- [ ] Historical risk tracking
- [ ] Portfolio recommendations
- [ ] Gas optimization suggestions

## License

MIT

## Built By

degenllama.net 🚀

---

**x402 Network Stats**
- 900K+ transactions/week
- $1.48M total volume
- 34,300% ecosystem growth
- Market projected: $30T by 2030
