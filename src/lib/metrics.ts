import type { Launch } from "./types";

/** Compute launch quality score (0–100) given a launch and its same-category peers. */
export function computeLaunchQualityScore(launch: Launch, peers: Launch[]): number {
  const pctile = (val: number, arr: number[]): number => {
    if (arr.length === 0) return 0.5;
    return arr.filter((v) => v <= val).length / arr.length;
  };

  const peers26w = peers.filter((p) => p.dollars26w !== null);

  const dollarsPctile = pctile(
    launch.dollars26w ?? 0,
    peers26w.map((p) => p.dollars26w!)
  );
  const velocityPctile = pctile(
    launch.velocityLatest,
    peers.map((p) => p.velocityLatest)
  );
  const distPctile = pctile(
    launch.distributionGainSinceLaunch,
    peers.map((p) => p.distributionGainSinceLaunch)
  );
  const baseMixScore = launch.baseMix;
  const survivalScore = launch.survived52w
    ? 1
    : launch.survived26w === true
    ? 0.6
    : launch.survived26w === false
    ? 0
    : 0.3; // unknown (too young)

  return Math.round(
    (dollarsPctile * 0.3 +
      velocityPctile * 0.25 +
      distPctile * 0.2 +
      baseMixScore * 0.15 +
      survivalScore * 0.1) *
      100
  );
}

/** Classify a launch as "winner" (top quartile), "middle", or "laggard". */
export function classifyLaunch(
  launch: Launch,
  peers: Launch[]
): "winner" | "middle" | "laggard" {
  const sortedScores = [...peers].map((p) => p.launchQualityScore).sort((a, b) => a - b);
  const q75 = sortedScores[Math.floor(sortedScores.length * 0.75)];
  const q25 = sortedScores[Math.floor(sortedScores.length * 0.25)];
  if (launch.launchQualityScore >= q75) return "winner";
  if (launch.launchQualityScore <= q25) return "laggard";
  return "middle";
}

/** Attribute win rate: what % of launches with this attribute are winners? */
export function attributeWinRate(
  launches: Launch[],
  attributeKey: keyof import("./types").AttributeSet,
  attributeValue: string | boolean,
  winners: Launch[]
): number {
  const withAttr = launches.filter((l) => l.attributes[attributeKey] === attributeValue);
  if (withAttr.length === 0) return 0;
  const winnerUpcs = new Set(winners.map((w) => w.upc));
  return withAttr.filter((l) => winnerUpcs.has(l.upc)).length / withAttr.length;
}

/** Brand innovation contribution: dollars from <52w launches / total brand growth */
export function brandInnovationContribution(
  newItemDollars: number,
  totalDollarGrowth: number
): number {
  if (totalDollarGrowth <= 0) return 0;
  return Math.min(newItemDollars / totalDollarGrowth, 1);
}

/** Price index: item price / category avg price */
export function priceIndex(itemPrice: number, categoryAvgPrice: number): number {
  if (categoryAvgPrice === 0) return 1;
  return itemPrice / categoryAvgPrice;
}
