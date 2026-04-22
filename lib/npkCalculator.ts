export interface NpkIngredient {
  id: string;
  name: string;
  brand: string;
  n: number;
  p: number;
  k: number;
}

export function calculateOptimalDryMix(
  ingredients: NpkIngredient[],
  targetN: number,
  targetP: number,
  targetK: number,
  totalWeightLbs: number
) {
  if (ingredients.length === 0) return [];
  
  // Start with 1 part of each selected ingredient
  let weights = ingredients.map(() => 1.0); 
  const learningRate = 0.01; 
  const iterations = 5000;

  for (let i = 0; i < iterations; i++) {
    let sumW = weights.reduce((a, b) => a + b, 0);
    if (sumW === 0) sumW = 0.0001; // prevent division by zero

    let currentN = weights.reduce((sum, w, idx) => sum + w * ingredients[idx].n, 0) / sumW;
    let currentP = weights.reduce((sum, w, idx) => sum + w * ingredients[idx].p, 0) / sumW;
    let currentK = weights.reduce((sum, w, idx) => sum + w * ingredients[idx].k, 0) / sumW;

    let errorN = currentN - targetN;
    let errorP = currentP - targetP;
    let errorK = currentK - targetK;

    // Adjust weights using Gradient Descent
    for (let j = 0; j < weights.length; j++) {
      let gradN = errorN * (ingredients[j].n - currentN) / sumW;
      let gradP = errorP * (ingredients[j].p - currentP) / sumW;
      let gradK = errorK * (ingredients[j].k - currentK) / sumW;

      weights[j] -= learningRate * (gradN + gradP + gradK);
      if (weights[j] < 0) weights[j] = 0; // Can't have negative fertilizer
    }
  }

  let finalSumW = weights.reduce((a, b) => a + b, 0) || 1;
  
  // Convert mathematical ratios into exact pounds
  return ingredients.map((ing, idx) => ({
    ...ing,
    calculated_lbs: Number(((weights[idx] / finalSumW) * totalWeightLbs).toFixed(2))
  })).filter(ing => ing.calculated_lbs > 0.01); // Filter out things it deemed unnecessary
}