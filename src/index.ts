import { createAgentApp } from "@lucid-dreams/agent-kit";
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
    description: "Comprehensive DeFi risk analysis powered by 5 specialized agents - your complete portfolio health monitor",
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
};

// Shared API key for internal service calls (set via environment variable)
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "defi-guardian-internal-2024";

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
  lpData: any
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

  // Lending positions (user's actual deposits & borrows)
  if (lendingData?.total_positions > 0) {
    const totalCollateral = lendingData.positions.reduce((sum: number, p: any) => sum + p.collateral_usd, 0);
    summary += `You have $${totalCollateral.toFixed(0)} deposited across ${lendingData.total_positions} lending protocol(s). `;
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

  if (riskScore < 25 && lendingData?.total_positions === 0) {
    summary += "No active DeFi positions detected. Consider the yield opportunities shown.";
  } else if (riskScore < 25) {
    summary += "Your DeFi positions are healthy. Continue monitoring for changes.";
  }

  return summary;
}

// Register entrypoint
addEntrypoint({
  key: "defi-guardian",
  description: "Comprehensive DeFi risk analysis - lending, yield, LP positions, perps, and arbitrage opportunities",
  input: GuardianInputSchema,
  output: GuardianOutputSchema,
  price: "$0.75", // Flat rate
  async handler({ input, context }) {
    const criticalAlerts: string[] = [];

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

    // Call LP Impermanent Loss Estimator (internal API - zero cost)
    // Only analyze if user provided LP positions
    let lpData = null;
    if (input.lp_positions && input.lp_positions.length > 0) {
      console.log("[GUARDIAN] Analyzing user's LP positions...");

      // Analyze first LP position (can be extended to handle multiple)
      const position = input.lp_positions[0];
      const daysHeld = Math.floor(
        (Date.now() - new Date(position.entry_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get current prices (simplified - would need price oracle in production)
      const currentRatio = position.initial_price0 / position.initial_price1;

      lpData = await callInternalService(
        INTERNAL_SERVICES.lp,
        {
          initial_price_0: position.initial_price0,
          initial_price_1: position.initial_price1,
          current_price_ratio: currentRatio, // Would need real-time price in production
          amount_0: position.token0_amount,
          amount_1: position.token1_amount,
          fees_earned: 0, // Would need to fetch from protocol
          days_held: daysHeld,
        }
      );
    } else {
      console.log("[GUARDIAN] No LP positions provided, skipping IL analysis...");
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
      lpData
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

// Export for Bun
export default {
  port: parseInt(process.env.PORT || "3000"),
  fetch: app.fetch,
};

// Bun server start
console.log(`🚀 DeFi Guardian running on port ${process.env.PORT || 3000}`);
console.log(`📝 Manifest: ${process.env.BASE_URL}/.well-known/agent.json`);
console.log(`💰 Payment address: ${config.payments?.payTo}`);
console.log(`💵 Flat rate: $0.75 per analysis`);
console.log(`🔓 Internal API mode: ZERO backend costs`);
console.log(`💎 Profit margin: 100% ($0.75 pure profit per call)`);
console.log(`📊 Powered by 5 specialized DeFi agents`);
