// Enums mirroring our Supabase schema
export type AmendmentType = 'synthetic' | 'organic' | 'compost' | 'mineral' | 'microbial';
export type ApplicationMethod = 'soil_drench' | 'foliar_spray' | 'top_dress' | 'soil_mix' | 'hydroponic';
export type GrowthStage = 'seedling' | 'vegetative' | 'flowering' | 'fruiting' | 'dormant' | 'pre_plant';
export type MeasurementUnit = 'ml' | 'tsp' | 'tbsp' | 'cup' | 'oz' | 'g' | 'lbs' | 'kg';
export type DilutionUnit = 'gallon' | 'liter' | 'sq_ft' | 'cubic_yard' | 'acre';

// Core Amendment interface
export interface Amendment {
  id: string;
  brand: string;
  name: string;
  type: AmendmentType;
  n_value: number;
  p_value: number;
  k_value: number;
  calcium?: number;
  magnesium?: number;
  derived_from?: string;
  barcode_upc?: string;
  image_url?: string;  // Primary image
  images?: string[];   // Array holding all captured photos
  thumbnail?: string;  // Base64 downscaled image
  createdAt: string;
  updatedAt: string;
}

// Feeding Schedule interface representing the manufacturer's matrix
export interface FeedingSchedule {
  id: string;
  amendment_id: string;
  growth_stage: GrowthStage;
  method: ApplicationMethod;
  dosage_amount: number;
  dosage_unit: MeasurementUnit;
  dilution_amount?: number;
  dilution_unit?: DilutionUnit;
  frequency_days?: number;
  notes?: string;
  createdAt: string;
}

// Joined type for fetching an amendment with its full schedule
export interface AmendmentWithSchedules extends Amendment {
  feeding_schedules: FeedingSchedule[];
}

// --- APOTHECARY & BREWERY TYPES ---

export type RecipeType = 'liquid_tea' | 'dry_mix' | 'extract' | 'ferment';
export type BrewStatus = 'brewing' | 'completed' | 'applied' | 'dumped';

export interface RecipeIngredient {
  name: string;
  amount: string | number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  type: RecipeType;
  description?: string;
  ingredients: RecipeIngredient[];
  instructions?: string;
  brew_time_hours?: number;
  base_brew_gallons?: number; // NEW
  dilution_ratio?: number;    // NEW
  created_at: string;
  updated_at: string;
}

export interface ActiveBrew {
  id: string;
  recipe_id?: string;
  custom_name: string;
  status: BrewStatus;
  start_time: string;
  target_completion_time?: string;
  yield_amount?: number;
  yield_unit?: string;
  notes?: string;
  created_at: string;
  // Joined relation:
  recipe?: Recipe;
}