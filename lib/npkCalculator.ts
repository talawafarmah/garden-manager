export interface NpkIngredient {
  id: string;
  name: string;
  n: number;
  p: number;
  k: number;
}

export function calculateDryMix(
  ingredients: NpkIngredient[],
  targetN: number,
  targetP: number,
  targetK: number,
  totalWeightLbs: number
) {
  // We use Gradient Descent to mathematically find the perfect blend
  // by minimizing the error between the current mix and the target NPK.
  let weights = ingredients.map(() => 1.0); // Start with equal parts
  const learningRate = 0.05;
  const iterations = 5000;

  for (let i = 0; i < iterations; i++) {
    let sumW = weights.reduce((a, b) => a + b, 0) || 0.0001;

    let currentN = weights.reduce((sum, w, idx) => sum + w * ingredients[idx].n, 0) / sumW;
    let currentP = weights.reduce((sum, w, idx) => sum + w * ingredients[idx].p, 0) / sumW;
    let currentK = weights.reduce((sum, w, idx) => sum + w * ingredients[idx].k, 0) / sumW;

    let errorN = currentN - targetN;
    let errorP = currentP - targetP;
    let errorK = currentK - targetK;

    // Adjust the weight of each ingredient based on how much it contributes to the error
    for (let j = 0; j < weights.length; j++) {
      let gradN = errorN * (ingredients[j].n - currentN) / sumW;
      let gradP = errorP * (ingredients[j].p - currentP) / sumW;
      let gradK = errorK * (ingredients[j].k - currentK) / sumW;

      weights[j] -= learningRate * (gradN + gradP + gradK);
      if (weights[j] < 0) weights[j] = 0; // Constraint: Can't have negative fertilizer!
    }
  }

  // Normalize the final calculated ratios to match the user's requested total weight
  let finalSumW = weights.reduce((a, b) => a + b, 0);
  return ingredients.map((ing, idx) => ({
    ...ing,
    parts: weights[idx],
    calculated_lbs: Number(((weights[idx] / finalSumW) * totalWeightLbs).toFixed(2))
  })).filter(ing => ing.calculated_lbs > 0); // Remove anything that calculated to 0
}