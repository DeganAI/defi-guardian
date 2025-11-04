import { createAgentApp } from "@lucid-dreams/agent-kit";
import { Hono } from "hono";
import { z } from "zod";

// Input schema
const GuardianInputSchema = z.object({
  wallet_address: z.string().describe("Wallet address to analyze"),
  chain_ids: z.array(z.number()).optional().default([1, 42161, 8453]).describe("Chain IDs to analyze (default: Ethereum, Arbitrum, Base)"),
  include_perps: z.boolean().optional().default(false).describe("Include perpetuals funding analysis"),
  include_arbitrage: z.boolean().optional().default(false).describe("Include cross-DEX arbitrage opportunities"),
  lp_positions: z.array(z.object({
    protocol: z.string().describe("DEX name (uniswap-v3, curve, balancer)"),
    token0_symbol: z.string(),
    token1_symbol: z.string(),
    token0_amount: z.number(),
    token1_amount: z.number(),
    initial_price0: z.number(),
    initial_price1: z.number(),
    entry_date: z.string().describe("ISO date when position was opened"),
  })).optional().describe("Optional: Your LP positions for accurate IL analysis"),
});

// Output schema
const GuardianOutputSchema = z.object({
  wallet_address: z.string(),
  overall_risk_score: z.number().describe("Risk score 0-100 (0=safe, 100=critical)"),
  total_positions: z.number(),
  critical_alerts: z.array(z.string()),
  lending_analysis: z.object({
    positions: z.array(z.any()),
    at_risk_count: z.number(),
  }).nullable(),
  yield_analysis: z.object({
    pools: z.array(z.any()),
    alerts_count: z.number(),
  }).nullable(),
  lp_analysis: z.object({
    il_percentage: z.number(),
    net_apr: z.number(),
    recommendation: z.string(),
  }).nullable(),
  perps_analysis: z.object({
    positions: z.array(z.any()),
  }).nullable(),
  arbitrage_opportunities: z.object({
    opportunities: z.array(z.any()),
  }).nullable(),
  summary: z.string(),
  timestamp: z.string(),
});

const { app, addEntrypoint, config } = createAgentApp(
  {
    name: "DeFi Guardian",
    version: "1.0.0",
    description: "Complete DeFi portfolio health monitoring via x402 micropayments",
    icon: "https://raw.githubusercontent.com/DeganAI/.github/main/defi-guardian-icon.svg",
    url: "https://degenllama.net",
    meta: {
      title: "DeFi Guardian",
      description: "Complete DeFi portfolio health monitoring via x402 micropayments",
      image: "https://defi-guardian-production.up.railway.app/favicon.ico",
    },
  },
  {
    config: {
      payments: {
        facilitatorUrl: "https://facilitator.daydreams.systems",
        payTo: "0x01D11F7e1a46AbFC6092d7be484895D2d505095c",
        network: "base",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        defaultPrice: "$0.75", // Flat rate
      },
    },
    useConfigPayments: true,
    ap2: {
      required: true,
      params: { roles: ["merchant"] },
    },
  }
);

// Internal API endpoints (zero cost - requires API key)
const INTERNAL_SERVICES = {
  lending: "https://lending-liquidation-sentinel-production.up.railway.app/api/internal/lending-liquidation-sentinel",
  yield: "https://yield-pool-watcher-production.up.railway.app/api/internal/yield-pool-watcher",
  lp: "https://lp-impermanent-loss-estimator-production-62b5.up.railway.app/api/internal/lp-impermanent-loss-estimator",
  perps: "https://perps-funding-pulse-production.up.railway.app/api/internal/perps-funding-pulse",
  arbitrage: "https://cross-dex-arbitrage-production.up.railway.app/api/internal/cross-dex-arbitrage",
  portfolio: "https://portfolio-scanner-production.up.railway.app/api/internal/portfolio-scanner",
};

// Shared API key for internal service calls (REQUIRED via environment variable)
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

if (!INTERNAL_API_KEY) {
  throw new Error("INTERNAL_API_KEY environment variable is required");
}

async function callInternalService(
  url: string,
  payload: any
): Promise<any> {
  try {
    // Call internal API with API key (no payment required)
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
  } catch (error) {
    console.error(`[INTERNAL] Error calling ${url}:`, error);
    return null;
  }
}

function calculateRiskScore(lendingData: any, lpData: any, yieldData: any): number {
  let score = 0;

  // Lending risk (0-50 points)
  if (lendingData?.positions) {
    const criticalCount = lendingData.positions.filter(
      (p: any) => p.health_factor < 1.2
    ).length;
    score += Math.min(criticalCount * 25, 50);
  }

  // LP impermanent loss risk (0-30 points)
  if (lpData?.il_percentage && lpData.il_percentage < -5) {
    score += Math.min(Math.abs(lpData.il_percentage) * 3, 30);
  }

  // Yield volatility risk (0-20 points)
  if (yieldData?.alerts_count) {
    score += Math.min(yieldData.alerts_count * 5, 20);
  }

  return Math.min(Math.round(score), 100);
}

function generateSummary(
  riskScore: number,
  criticalAlerts: string[],
  lendingData: any,
  yieldData: any,
  lpData: any,
  portfolioData: any
): string {
  const riskLevel =
    riskScore >= 75
      ? "🚨 CRITICAL"
      : riskScore >= 50
      ? "⚠️ HIGH"
      : riskScore >= 25
      ? "ℹ️ MODERATE"
      : "✅ LOW";

  let summary = `${riskLevel} risk detected (score: ${riskScore}/100). `;

  // LP positions (auto-detected from portfolio scanner)
  const lpPositions = portfolioData?.lp_positions || [];
  const totalLpValue = portfolioData?.total_portfolio_value_usd || 0;
  if (lpPositions.length > 0) {
    summary += `Found ${lpPositions.length} LP position(s) worth $${totalLpValue.toFixed(0)} across ${[...new Set(lpPositions.map((p: any) => p.protocol))].length} DEX(es). `;
  }

  // Lending positions (user's actual deposits & borrows)
  if (lendingData?.total_positions > 0) {
    const totalCollateral = lendingData.positions.reduce((sum: number, p: any) => sum + p.collateral_usd, 0);
    summary += `$${totalCollateral.toFixed(0)} deposited across ${lendingData.total_positions} lending protocol(s). `;
  }

  if (criticalAlerts.length > 0) {
    summary += `${criticalAlerts.length} critical alert(s) require immediate attention. `;
  }

  if (lendingData?.at_risk_count > 0) {
    summary += `${lendingData.at_risk_count} position(s) at liquidation risk. `;
  }

  if (lpData?.net_apr) {
    if (lpData.net_apr < 0) {
      summary += `LP position showing negative returns (${lpData.net_apr.toFixed(2)}% APR). `;
    } else {
      summary += `LP position earning ${lpData.net_apr.toFixed(2)}% net APR. `;
    }
  }

  if (yieldData?.pools?.length > 0) {
    summary += `Found ${yieldData.pools.length} high-yield opportunities. `;
  }

  if (riskScore < 25 && lendingData?.total_positions === 0 && lpPositions.length === 0) {
    summary += "No active DeFi positions detected. Consider the yield opportunities shown.";
  } else if (riskScore < 25) {
    summary += "Your DeFi positions are healthy. Continue monitoring for changes.";
  }

  return summary;
}

// Add custom root route with Open Graph meta tags (must be added AFTER agent-kit routes are set up)
// This will be added after entrypoints are registered

// Register entrypoint
addEntrypoint({
  key: "defi-guardian",
  description: "Comprehensive DeFi risk analysis - lending, yield, LP positions, perps, and arbitrage opportunities",
  input: GuardianInputSchema,
  output: GuardianOutputSchema,
  price: "$0.75", // Flat rate
  async handler({ input, context }) {
    const criticalAlerts: string[] = [];

    // NEW: Call Portfolio Scanner to auto-detect LP positions (internal API - zero cost)
    console.log("[GUARDIAN] Scanning wallet for LP positions...");
    const portfolioData = await callInternalService(
      INTERNAL_SERVICES.portfolio,
      {
        wallet_address: input.wallet_address,
        chain_ids: input.chain_ids,
      }
    );

    console.log(`[GUARDIAN] Found ${portfolioData?.lp_positions?.length || 0} LP positions`);

    // Call Lending Liquidation Sentinel (internal API - zero cost)
    console.log("[GUARDIAN] Analyzing lending positions...");
    const lendingData = await callInternalService(
      INTERNAL_SERVICES.lending,
      {
        wallet_address: input.wallet_address,
        chain_ids: input.chain_ids,
        protocols: ["aave", "compound"],
        alert_threshold: 1.5,
      }
    );

    if (lendingData?.positions) {
      lendingData.positions.forEach((pos: any) => {
        if (pos.health_factor < 1.2) {
          criticalAlerts.push(
            `🚨 ${pos.protocol} on chain ${pos.chain_id}: Health factor ${pos.health_factor.toFixed(2)}`
          );
        }
      });
    }

    // Call Yield Pool Watcher (internal API - zero cost)
    console.log("[GUARDIAN] Analyzing yield pools...");
    const yieldData = await callInternalService(
      INTERNAL_SERVICES.yield,
      {
        protocol_ids: ["aave-v3", "compound-v3", "uniswap-v3"],
        chain_ids: input.chain_ids,
        apy_threshold: 10,
        tvl_threshold: 0.2,
      }
    );

    // Analyze detected LP positions using IL Estimator (internal API - zero cost)
    let lpData = null;
    const lpPositions = portfolioData?.lp_positions || [];

    if (lpPositions.length > 0) {
      console.log(`[GUARDIAN] Analyzing ${lpPositions.length} detected LP positions for impermanent loss...`);

      // Analyze first LP position (can be extended to handle multiple)
      const position = lpPositions[0];

      // Determine entry date - use provided date or estimate (30 days ago)
      const entryDate = input.lp_entry_date
        ? new Date(input.lp_entry_date)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const daysHeld = Math.floor(
        (Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate initial prices (estimate from current amounts - simplified)
      const initial_price_0 = position.token0_price_usd;
      const initial_price_1 = position.token1_price_usd;
      const currentRatio = position.token0_price_usd / position.token1_price_usd;

      lpData = await callInternalService(
        INTERNAL_SERVICES.lp,
        {
          initial_price_0,
          initial_price_1,
          current_price_ratio: currentRatio,
          amount_0: position.token0_amount,
          amount_1: position.token1_amount,
          fees_earned: position.fees_owed_0 ?
            (position.fees_owed_0 * position.token0_price_usd + position.fees_owed_1 * position.token1_price_usd) : 0,
          days_held: daysHeld,
        }
      );

      // Add critical alert if IL is significant
      if (lpData?.il_percentage && lpData.il_percentage < -10) {
        criticalAlerts.push(
          `💸 ${position.protocol}: ${lpData.il_percentage.toFixed(2)}% impermanent loss detected`
        );
      }
    } else {
      console.log("[GUARDIAN] No LP positions detected, skipping IL analysis...");
    }

    // Optional: Call Perps Funding Pulse (internal API - zero cost)
    let perpsData = null;
    if (input.include_perps) {
      console.log("[GUARDIAN] Analyzing perpetuals funding...");
      perpsData = await callInternalService(
        INTERNAL_SERVICES.perps,
        {
          venue_ids: ["okx", "hyperliquid"], // Using working exchanges only
          markets: ["BTC/USDT:USDT", "ETH/USDT:USDT"],
        }
      );
    }

    // Optional: Call Cross DEX Arbitrage (internal API - zero cost)
    let arbitrageData = null;
    if (input.include_arbitrage) {
      console.log("[GUARDIAN] Scanning arbitrage opportunities...");
      arbitrageData = await callInternalService(
        INTERNAL_SERVICES.arbitrage,
        {
          chain_id: input.chain_ids[0] || 1, // Use first chain from input
          min_profit_pct: 0.3, // 0.3% minimum profit
        }
      );
    }

    // Calculate overall risk score
    const riskScore = calculateRiskScore(lendingData, lpData, yieldData);

    // Generate summary
    const summary = generateSummary(
      riskScore,
      criticalAlerts,
      lendingData,
      yieldData,
      lpData,
      portfolioData
    );

    return {
      output: {
        wallet_address: input.wallet_address,
        overall_risk_score: riskScore,
        total_positions:
          (lendingData?.total_positions || 0) +
          (yieldData?.pools?.length || 0),
        critical_alerts: criticalAlerts,
        lending_analysis: lendingData
          ? {
              positions: lendingData.positions || [],
              at_risk_count: lendingData.at_risk_count || 0,
            }
          : null,
        yield_analysis: yieldData
          ? {
              pools: yieldData.pools || [],
              alerts_count: yieldData.alerts_count || 0,
            }
          : null,
        lp_analysis: lpData
          ? {
              il_percentage: lpData.il_percentage || 0,
              net_apr: lpData.net_apr || 0,
              recommendation: lpData.recommendation || "No data",
            }
          : null,
        perps_analysis: perpsData
          ? {
              positions: perpsData.positions || [],
            }
          : null,
        arbitrage_opportunities: arbitrageData
          ? {
              opportunities: arbitrageData.opportunities || [],
            }
          : null,
        summary,
        timestamp: new Date().toISOString(),
      },
    };
  },
});

// Create wrapper app for custom routes and internal API
const wrapperApp = new Hono();

// Mount the x402 agent app first (provides all agent-kit routes)
wrapperApp.route("/", app);

// Add favicon route for x402scan display (overrides agent-kit's favicon if any)
wrapperApp.get("/favicon.ico", (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <text y="80" font-size="80">🛡️</text>
</svg>`;

  return c.body(svg, 200, { "Content-Type": "image/svg+xml" });
});

// Add custom root route with Open Graph meta tags (overrides agent-kit's root route)
wrapperApp.get("/", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DeFi Guardian</title>
    <link rel="icon" href="/favicon.ico" type="image/svg+xml">

    <!-- Open Graph tags -->
    <meta property="og:title" content="DeFi Guardian">
    <meta property="og:description" content="Complete DeFi portfolio health monitoring via x402 micropayments">
    <meta property="og:image" content="https://defi-guardian-production.up.railway.app/favicon.ico">

    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            line-height: 1.6;
            color: #e6f4ea;
            background: linear-gradient(135deg, #0c2713 0%, #154725 100%);
            min-height: 100vh;
        }
        .container {
            background: rgba(10, 31, 17, 0.95);
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(118, 173, 139, 0.3);
        }
        h1 {
            color: #6de8a5;
            margin-top: 0;
            font-size: 2.5em;
        }
        .shield {
            font-size: 3em;
            margin-bottom: 20px;
        }
        a {
            color: #6de8a5;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .section {
            margin: 30px 0;
        }
        code {
            background: rgba(109, 232, 165, 0.18);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="shield">🛡️</div>
        <h1>DeFi Guardian</h1>
        <p><strong>Complete DeFi portfolio health monitoring via x402 micropayments</strong></p>

        <div class="section">
            <h2>Features</h2>
            <ul>
                <li>🔍 Auto-detects LP positions across Uniswap V3, Curve, Balancer, SushiSwap</li>
                <li>💰 Monitors lending positions for liquidation risk</li>
                <li>📊 Analyzes impermanent loss on active LP positions</li>
                <li>🎯 Tracks high-yield farming opportunities</li>
                <li>⚡ Optional perpetuals funding rate monitoring</li>
                <li>💱 Optional cross-DEX arbitrage detection</li>
            </ul>
        </div>

        <div class="section">
            <h2>Pricing</h2>
            <p>$0.75 per comprehensive analysis (flat rate, paid in USDC on Base)</p>
            <p><em>100% profit margin - all backend APIs are zero-cost internal services</em></p>
        </div>

        <div class="section">
            <h2>API Documentation</h2>
            <p>Manifest: <a href="/.well-known/agent.json">/.well-known/agent.json</a></p>
            <p>Powered by <a href="https://degenllama.net" target="_blank">degenllama.net</a></p>
        </div>
    </div>
</body>
</html>`;

  return c.html(html);
});

// Export for Bun
export default {
  port: parseInt(process.env.PORT || "3000"),
  fetch: wrapperApp.fetch,
};

// Bun server start
console.log(`🚀 DeFi Guardian running on port ${process.env.PORT || 3000}`);
console.log(`📝 Manifest: ${process.env.BASE_URL}/.well-known/agent.json`);
console.log(`💰 Payment address: ${config.payments?.payTo}`);
console.log(`💵 Flat rate: $0.75 per analysis`);
console.log(`🔓 Internal API mode: ZERO backend costs`);
console.log(`💎 Profit margin: 100% ($0.75 pure profit per call)`);
console.log(`🔍 Auto-detects LP positions across Uniswap V3, Curve, Balancer, SushiSwap`);
console.log(`📊 Powered by 6 specialized DeFi agents`);
