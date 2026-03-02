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
  | 'seedlings'
  | 'admin_seasons' 
  | 'admin_demand';

export interface SeedCategory {
  name: string;
  prefix: string;
}

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

  returnTo?: AppView;
  returnPayload?: any;
  newCatName?: string;
  newCatPrefix?: string;
}

export interface TraySeedRecord {
  cell: number;
  seed_id: string;
}

export interface SeedlingTray {
  id: string;
  name?: string; // NEW: Added proper name field
  sown_date: string;
  cell_count: number;
  contents: TraySeedRecord[];
  notes?: string;
  images?: string[];
  humidity_dome?: boolean;
  grow_light?: boolean;
  first_germination_date?: string;
  first_planted_date?: string;
  potting_mix?: string;
  location?: string;
  season_id?: string; 
}

export interface Season {
  id: string;
  name: string;
  status: 'Planning' | 'Active' | 'Archived';
  created_at: string;
}

export interface WishlistSession {
  id: string; 
  list_name: string;
  season_id: string;
  expires_at?: string;
  created_at: string;
}

export interface WishlistSelection {
  id: string;
  session_id: string;
  seed_id?: string; 
  custom_request?: string;
  created_at: string;
  seed?: InventorySeed; 
}

export interface SeedlingJournalEntry {
  id: string;
  date: string;
  type: 'UPPOT' | 'FERTILIZE' | 'EVENT' | 'NOTE';
  note: string;
}

export interface SeasonSeedling {
  id: string;
  seed_id: string;
  season_id: string;
  
  qty_growing: number;
  
  allocate_keep: number;
  allocate_reserve: number;
  
  qty_planted: number;
  qty_gifted: number;
  qty_sold: number;
  qty_dead: number;
  
  locations: Record<string, number>; 
  journal: SeedlingJournalEntry[];
  
  created_at?: string;
  updated_at?: string;

  seed?: InventorySeed;
  season?: Season;
}