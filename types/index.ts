// types.ts

export type AppView = 
  | 'dashboard' 
  | 'vault' 
  | 'seed_detail' 
  | 'seed_edit' 
  | 'scanner' 
  | 'importer'
  | 'trays'
  | 'tray_detail'
  | 'tray_edit'
  | 'admin_seasons'  // NEW: Manage seasons and generate magic links
  | 'admin_demand';  // NEW: The aggregated demand planner

export interface SeedCategory {
  name: string;
  prefix: string;
}

// Used by the AI Scanner & Importer before saving to the DB
export interface SeedData {
  variety_name?: string;
  vendor?: string;
  days_to_maturity?: number;
  species?: string;
  category?: string;
  tomato_type?: string;
  notes?: string;
  companion_plants?: string[];
  seed_depth?: string;
  plant_spacing?: string;
  row_spacing?: string;
  germination_days?: string;
  sunlight?: string;
  lifecycle?: string;
  cold_stratification?: boolean;
  stratification_days?: number;
  light_required?: boolean;
  scoville_rating?: number;
}

export interface InventorySeed {
  id: string;
  category: string;
  variety_name: string;
  vendor?: string;
  days_to_maturity?: number;
  species?: string;
  notes?: string;
  images?: string[];
  primaryImageIndex?: number;
  companion_plants?: string[];
  cold_stratification?: boolean;
  stratification_days?: number;
  light_required?: boolean;
  germination_days?: string;
  seed_depth?: string;
  plant_spacing?: string;
  row_spacing?: string;
  out_of_stock?: boolean;
  sunlight?: string;
  lifecycle?: string;
  thumbnail?: string;
  scoville_rating?: number;
  tomato_type?: string;
  parent_id_female?: string;
  parent_id_male?: string;
  generation?: string;

  // Temporary UI/Navigation state (not saved to the database)
  returnTo?: AppView;
  returnPayload?: any;
  newCatName?: string;
  newCatPrefix?: string;
}

export interface SeedlingTray {
  id: string;
  sown_date: string;
  cell_count: number;
  contents: { cell: number; seed_id: string }[];
  notes?: string;
  images?: string[];
  humidity_dome?: boolean;
  grow_light?: boolean;
  first_germination_date?: string;
  first_planted_date?: string;
  potting_mix?: string;
  location?: string;
  season_id?: string; // NEW: Links this tray to a specific season
}

// ==========================================
// NEW: Community Nursery & Planning Types
// ==========================================

export interface Season {
  id: string;
  name: string;
  status: 'Planning' | 'Active' | 'Archived';
  created_at: string;
}

export interface WishlistSession {
  id: string; // The magic token (UUID)
  list_name: string;
  season_id: string;
  expires_at?: string;
  created_at: string;
}

export interface WishlistSelection {
  id: string;
  session_id: string;
  seed_id?: string; // Null if it's a custom write-in request
  custom_request?: string;
  created_at: string;
  
  // Joined data we will fetch for the UI to display the requested seed details
  seed?: InventorySeed; 
}