// ── Synthetic social post data for Consumer Discussions panels ───────────────
//
// Realistic CPG consumer discussion templates, selected and randomised via a
// seeded RNG so the same query always yields the same posts.
//
// Future upgrade: replace `getSocialPosts` in /api/reddit/route.ts with a live
// call to the Reddit OAuth API or a social listening platform (Brandwatch etc.)
// All UI components are unchanged — only route.ts needs to be swapped.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SocialPost {
  title: string;
  subreddit: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
}

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function randBase36(rand: () => number, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += Math.floor(rand() * 36).toString(36);
  }
  return out;
}

// ── Template bank ─────────────────────────────────────────────────────────────

interface PostTemplate {
  title: string;
  subreddit: string;
}

const POOLS: Record<string, PostTemplate[]> = {
  organic: [
    { title: "Finally found an organic protein bar that doesn't taste like cardboard", subreddit: "HealthyFood" },
    { title: "Switching to organic snacks — worth the premium? 6-month experiment", subreddit: "EatCheapAndHealthy" },
    { title: "Best organic snack brands you can actually find at a regular grocery store", subreddit: "nutrition" },
    { title: "Organic certification breakdown — what it actually means for your food", subreddit: "nutrition" },
    { title: "Tried 12 organic granola bars so you don't have to — ranked", subreddit: "HealthyFood" },
    { title: "Whole Foods vs Trader Joe's organic snacks: honest comparison after 3 months", subreddit: "Frugal" },
    { title: "Why I stopped buying organic everything and what I kept — a realistic take", subreddit: "EatCheapAndHealthy" },
    { title: "Organic snacks that my non-health-conscious partner actually eats", subreddit: "HealthyFood" },
    { title: "Are organic labels on snacks worth it if the rest of your diet isn't organic?", subreddit: "nutrition" },
    { title: "Costco's organic snack section has gotten surprisingly good lately", subreddit: "Costco" },
    { title: "Best budget-friendly organic snacks — my current rotation", subreddit: "EatCheapAndHealthy" },
  ],

  "non-gmo": [
    { title: "Non-GMO vs Organic — what's the actual difference? A breakdown", subreddit: "nutrition" },
    { title: "Does the Non-GMO Project butterfly label actually mean anything?", subreddit: "AskScience" },
    { title: "Non-GMO snacks that are actually affordable at regular supermarkets", subreddit: "EatCheapAndHealthy" },
    { title: "I spent 3 weeks trying only Non-GMO certified snacks — here's what I found", subreddit: "HealthyFood" },
    { title: "Non-GMO labeling is marketing, right? Convince me otherwise", subreddit: "nutrition" },
    { title: "Best Non-GMO verified bars for kids lunchboxes", subreddit: "Parenting" },
    { title: "Why more food brands are going Non-GMO certified even when it doesn't matter nutritionally", subreddit: "foodscience" },
    { title: "Non-GMO protein powders that don't break the bank", subreddit: "fitness" },
    { title: "Trader Joe's Non-GMO snack haul — impressively affordable", subreddit: "EatCheapAndHealthy" },
    { title: "Comprehensive guide to what Non-GMO actually means on food packaging", subreddit: "nutrition" },
  ],

  gluten: [
    { title: "GF snack bars that non-celiac family members actually enjoy — my list", subreddit: "glutenfree" },
    { title: "Best certified gluten-free protein bars — taste-tested and ranked 2025", subreddit: "glutenfree" },
    { title: "Accidentally ate gluten again — these snacks got me through the week", subreddit: "Celiac" },
    { title: "Going gluten-free for 30 days changed more than I expected — my snack haul", subreddit: "HealthyFood" },
    { title: "Cross-contamination risk is the real issue — which GF brands take it seriously?", subreddit: "Celiac" },
    { title: "Gluten-free snack aisle has exploded — what's actually worth buying vs. what's hype", subreddit: "glutenfree" },
    { title: "My celiac kid will actually eat these — GF snacks approved by a picky 8-year-old", subreddit: "glutenfree" },
    { title: "Price comparison: GF vs regular snacks at major retailers. The gap is closing.", subreddit: "Frugal" },
    { title: "Best on-the-go gluten-free snacks for travel — airport and road trip tested", subreddit: "glutenfree" },
    { title: "Which GF certification marks are actually rigorous? GFFS vs NSF vs others", subreddit: "Celiac" },
    { title: "New GF granola brands that launched this year — worth the hype?", subreddit: "glutenfree" },
  ],

  vegan: [
    { title: "Best vegan protein snacks that actually keep you full post-workout", subreddit: "veganfitness" },
    { title: "New plant-based snack bar I found at Whole Foods — honestly impressed", subreddit: "vegan" },
    { title: "Vegan snack haul review: what's worth buying and what's a marketing trick", subreddit: "vegan" },
    { title: "High protein vegan snacks under 200 calories — my current rotation", subreddit: "PlantBasedDiet" },
    { title: "Vegan snack tier list — ranked by taste, protein per dollar, and availability", subreddit: "vegan" },
    { title: "Plant-based protein bars that actually taste good without 40 ingredients", subreddit: "PlantBasedDiet" },
    { title: "Tried every vegan bar at Target — here's the honest breakdown", subreddit: "vegan" },
    { title: "6 months of eating vegan snacks only — what I learned about nutrition labels", subreddit: "veganfitness" },
    { title: "Vegan snacks my non-vegan coworkers keep stealing from the break room", subreddit: "vegan" },
    { title: "Best whole-food vegan snacks vs ultra-processed vegan snacks comparison", subreddit: "PlantBasedDiet" },
    { title: "Which plant-based protein sources actually have complete amino acid profiles?", subreddit: "veganfitness" },
  ],

  keto: [
    { title: "Keto snacks that actually keep me in ketosis — my running list after 2 years", subreddit: "keto" },
    { title: "Zero-net-carb snacks I swear by for staying in ketosis through the work day", subreddit: "ketorecipes" },
    { title: "Honest ranking of store-bought keto protein bars by net carbs and taste", subreddit: "keto" },
    { title: "Best keto snacks at Costco — current finds and prices", subreddit: "keto" },
    { title: "6 months keto: the snacks that made the difference vs ones that knocked me out", subreddit: "ketodiet" },
    { title: "Keto snack bars with the best fat-to-protein ratio for satiety", subreddit: "keto" },
    { title: "Which 'keto-friendly' bars are actually keto? Tested with blood glucose meter", subreddit: "keto" },
    { title: "Lazy keto snack ideas that don't require any prep", subreddit: "ketorecipes" },
    { title: "Keto electrolyte snacks that don't taste like medicine — recommendations?", subreddit: "keto" },
    { title: "Budget keto snacks under $2 per serving — a curated list", subreddit: "ketodiet" },
    { title: "New keto snack brands worth trying vs established favorites — 2025 edition", subreddit: "keto" },
  ],

  protein: [
    { title: "High protein snacks that actually fit in a gym bag — no refrigeration required", subreddit: "fitness" },
    { title: "30g+ protein snacks under 300 calories — what actually works for cutting", subreddit: "loseit" },
    { title: "Best protein bars for bulking that don't blow your fat macros", subreddit: "gainit" },
    { title: "Protein snacks that helped me consistently hit my macros for 6 months", subreddit: "loseit" },
    { title: "Honest ranking of protein bars by actual protein content vs label claims", subreddit: "Fitness" },
    { title: "High protein snacks that don't spike blood sugar — diabetes-friendly options", subreddit: "diabetes" },
    { title: "Whey vs plant protein bars — which actually builds more muscle per dollar?", subreddit: "veganfitness" },
    { title: "Protein snack timing around workouts — what the research actually says", subreddit: "fitness" },
    { title: "Best tasting protein bars after trying literally every one at GNC", subreddit: "Fitness" },
    { title: "Protein snack haul: what I found at Costco vs Amazon vs local supplement store", subreddit: "gainit" },
    { title: "The protein bar industry is misleading consumers — here's how to read labels", subreddit: "nutrition" },
  ],

  supplement: [
    { title: "Supplement snack bars that actually deliver on their claims — evidence check", subreddit: "Supplements" },
    { title: "Best collagen protein snacks with actual clinical backing vs marketing hype", subreddit: "nutrition" },
    { title: "Adaptogens in snack bars — worth it or just marketing? Research summary", subreddit: "Supplements" },
    { title: "Functional snack bars I've added to my daily routine and noticed a difference", subreddit: "Supplements" },
    { title: "Magnesium, vitamin D, zinc — snacks that actually help you hit micronutrient goals", subreddit: "nutrition" },
    { title: "Prebiotic and probiotic snack bars — which ones have enough CFUs to matter?", subreddit: "Supplements" },
    { title: "Nootropic snacks: do any of them actually work? Community experiences", subreddit: "nootropics" },
    { title: "Greens powder snacks vs eating actual vegetables — honest comparison", subreddit: "nutrition" },
  ],

  snack: [
    { title: "Best healthy snacks under 200 calories that actually satisfy cravings", subreddit: "HealthyFood" },
    { title: "Snack brands that have improved quality in the last 2 years — and ones that declined", subreddit: "snackexchange" },
    { title: "Office snack drawer essentials: what I keep stocked for 50 people", subreddit: "EatCheapAndHealthy" },
    { title: "Clean-label snacks I've found at each major grocery chain — state of the market", subreddit: "HealthyFood" },
    { title: "Snack bar vs whole food snacks for sustained energy — what works better?", subreddit: "nutrition" },
    { title: "The best new snack brands of 2025 — community recommendations thread", subreddit: "snackexchange" },
    { title: "Healthy snack subscriptions worth it? Tried 5 of them — here's my verdict", subreddit: "Frugal" },
    { title: "Gas station healthy snack tier list — best options when you're traveling", subreddit: "EatCheapAndHealthy" },
  ],

  beverage: [
    { title: "Functional beverage brands that actually taste good — an honest review", subreddit: "HealthyDrinks" },
    { title: "Clean ingredient energy drinks vs traditional — switching after 2 years", subreddit: "nutrition" },
    { title: "Best low-sugar sports drinks for actual athletes vs weekend warriors", subreddit: "fitness" },
    { title: "Adaptogens in drinks: tried 8 brands for 3 months — here's what I noticed", subreddit: "HealthyDrinks" },
    { title: "Prebiotic sodas are having a moment — which ones are worth the hype?", subreddit: "HealthyFood" },
    { title: "Replacing afternoon coffee with these functional drinks changed my sleep", subreddit: "sleep" },
    { title: "Natural electrolyte drinks without artificial sweeteners — the complete list", subreddit: "HealthyDrinks" },
    { title: "Protein shakes vs protein water vs protein bars — which fits your lifestyle?", subreddit: "nutrition" },
  ],

  frozen: [
    { title: "Frozen meal brands that have actually gotten healthier — 2025 update", subreddit: "MealPrep" },
    { title: "High protein frozen meals that don't taste like diet food — my top 10", subreddit: "EatCheapAndHealthy" },
    { title: "Keto frozen meals at Walmart and Target — current finds and honest reviews", subreddit: "keto" },
    { title: "Clean-ingredient frozen meals for busy weeknights — what I keep stocked", subreddit: "MealPrep" },
    { title: "Comparing frozen meal macros to cooking the same dish from scratch", subreddit: "nutrition" },
    { title: "Vegan frozen meals that are actually filling — updated list for 2025", subreddit: "vegan" },
    { title: "Frozen meals I eat weekly vs ones I tried once — real ingredient comparison", subreddit: "EatCheapAndHealthy" },
    { title: "Gluten-free frozen meals that don't sacrifice flavor — community picks", subreddit: "glutenfree" },
  ],

  default: [
    { title: "The state of better-for-you food in 2025 — what's improved and what's still hype", subreddit: "HealthyFood" },
    { title: "CPG brand transparency is getting better — here's how to actually read a label", subreddit: "nutrition" },
    { title: "Clean label snacks I've found at every major grocery chain", subreddit: "EatCheapAndHealthy" },
    { title: "Whole Foods vs Costco vs Target for health-focused snack shopping", subreddit: "Frugal" },
    { title: "Functional foods are everywhere now — which categories actually deliver results?", subreddit: "nutrition" },
    { title: "New food brand launches worth trying — community discovery thread", subreddit: "HealthyFood" },
    { title: "How I evaluate a new health food product before buying — my checklist", subreddit: "nutrition" },
    { title: "Small food brands doing things better than the big players right now", subreddit: "HealthyFood" },
    { title: "Health food marketing claims that mean something vs ones that don't", subreddit: "nutrition" },
    { title: "What I've learned about reading ingredient lists after 5 years of trying", subreddit: "EatCheapAndHealthy" },
  ],
};

// ── Pool selection ─────────────────────────────────────────────────────────────

const POOL_KEYWORDS: Array<[string, string]> = [
  ["organic", "organic"],
  ["non-gmo", "non-gmo"],
  ["non gmo", "non-gmo"],
  ["nongmo", "non-gmo"],
  ["gluten", "gluten"],
  ["celiac", "gluten"],
  ["vegan", "vegan"],
  ["plant-based", "vegan"],
  ["plant based", "vegan"],
  ["keto", "keto"],
  ["ketogenic", "keto"],
  ["protein", "protein"],
  ["high protein", "protein"],
  ["supplement", "supplement"],
  ["collagen", "supplement"],
  ["probiotic", "supplement"],
  ["adaptogen", "supplement"],
  ["beverage", "beverage"],
  ["drink", "beverage"],
  ["energy drink", "beverage"],
  ["frozen", "frozen"],
  ["meal", "frozen"],
  ["snack", "snack"],
  ["bar", "snack"],
  ["chip", "snack"],
];

function selectPool(query: string): PostTemplate[] {
  const q = query.toLowerCase();
  const matched = new Set<string>();

  for (const [keyword, poolKey] of POOL_KEYWORDS) {
    if (q.includes(keyword)) matched.add(poolKey);
  }

  if (matched.size === 0) return POOLS.default;

  const combined: PostTemplate[] = [];
  for (const key of matched) {
    combined.push(...(POOLS[key] ?? []));
  }
  return combined;
}

// ── Generator ─────────────────────────────────────────────────────────────────

export function getSocialPosts(query: string, limit: number): SocialPost[] {
  const pool = selectPool(query);
  const rand = mulberry32(seedFromString(query));
  const nowSec = Math.floor(Date.now() / 1000);
  const posts: SocialPost[] = [];
  const usedIndexes = new Set<number>();

  for (let i = 0; i < limit; i++) {
    // Pick a template, avoiding repeats when possible
    let idx: number;
    let attempts = 0;
    do {
      idx = Math.floor(rand() * pool.length);
      attempts++;
    } while (usedIndexes.has(idx) && attempts < pool.length * 2);
    usedIndexes.add(idx);

    const template = pool[idx];

    const score      = Math.round(50 + rand() * 1150);
    const ratio      = Math.round((0.68 + rand() * 0.30) * 100) / 100;
    const comments   = Math.round(5 + rand() * 115);
    const ageSeconds = Math.floor(rand() * 30 * 86400);
    const permalink  = `/r/${template.subreddit}/comments/${randBase36(rand, 6)}/`;

    posts.push({
      title:        template.title,
      subreddit:    template.subreddit,
      score,
      upvote_ratio: ratio,
      num_comments: comments,
      created_utc:  nowSec - ageSeconds,
      permalink,
    });
  }

  return posts;
}
