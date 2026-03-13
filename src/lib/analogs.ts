import type { Launch, Category } from "./types";

const CATEGORIES: Category[] = ["Bars", "Beverages", "Snacks", "Supplements", "Frozen Meals"];

function oneHotCategory(cat: Category): number[] {
  return CATEGORIES.map((c) => (c === cat ? 1 : 0));
}

function priceTierIndex(price: number): number {
  if (price < 3) return 0;
  if (price < 6) return 1;
  if (price < 10) return 2;
  return 3;
}

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (val - min) / (max - min);
}

function buildFeatureVector(l: Launch, allLaunches: Launch[]): number[] {
  const velocities = allLaunches.map((x) => x.velocityLatest);
  const tdps = allLaunches.map((x) => x.tdpLatest);
  const minV = Math.min(...velocities);
  const maxV = Math.max(...velocities);
  const minT = Math.min(...tdps);
  const maxT = Math.max(...tdps);

  return [
    ...oneHotCategory(l.category).map((v) => v * 2), // weight category higher
    priceTierIndex(l.priceLatest) / 3,
    l.attributes.isOrganic ? 1 : 0,
    l.attributes.isNonGmo ? 1 : 0,
    l.attributes.isGlutenFree ? 1 : 0,
    l.attributes.isVegan ? 1 : 0,
    l.attributes.isKeto ? 1 : 0,
    l.attributes.isProteinFocused ? 1 : 0,
    normalize(l.velocityLatest, minV, maxV),
    normalize(l.tdpLatest, minT, maxT),
  ];
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export interface AnalogResult {
  launch: Launch;
  similarityScore: number; // 0–100
  sharedAttributes: string[];
}

export function findAnalogs(
  target: Launch,
  allLaunches: Launch[],
  topN = 5
): AnalogResult[] {
  const candidates = allLaunches.filter((l) => l.upc !== target.upc);
  const targetVec = buildFeatureVector(target, allLaunches);

  const scored = candidates
    .map((l) => ({
      launch: l,
      similarityScore: cosineSimilarity(targetVec, buildFeatureVector(l, allLaunches)),
    }))
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, topN);

  return scored.map(({ launch, similarityScore }) => {
    const sharedAttributes: string[] = [];
    if (target.category === launch.category) sharedAttributes.push(launch.category);
    if (target.attributes.isOrganic && launch.attributes.isOrganic) sharedAttributes.push("Organic");
    if (target.attributes.isKeto && launch.attributes.isKeto) sharedAttributes.push("Keto");
    if (target.attributes.isVegan && launch.attributes.isVegan) sharedAttributes.push("Vegan");
    if (target.attributes.isProteinFocused && launch.attributes.isProteinFocused)
      sharedAttributes.push("Protein");
    if (target.attributes.isNonGmo && launch.attributes.isNonGmo) sharedAttributes.push("Non-GMO");
    if (target.attributes.form === launch.attributes.form)
      sharedAttributes.push(launch.attributes.form);
    return { launch, similarityScore: Math.round(similarityScore * 100), sharedAttributes };
  });
}
