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
  | 'admin_hub'         
  | 'admin_categories'  
  | 'admin_seasons' 
  | 'admin_demand'
  | 'grow_planner'
  | 'farm_map';

  export interface GardenArea {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface GardenBed {
  id: string;
  area_id: string;
  name: string;
  type: string; 
  irrigation_type?: string; 
  dimensions?: string;
  soil_mix?: string;
  notes?: string;
  created_at?: string;
}

export interface FieldPlanting {
  id: string;
  bed_id: string;
  seed_id: string;
  season_id: string;
  plant_date: string;
  qty_planted: number;
  status: string; 
  yield_lbs?: number;
  yield_count?: number;
  notes?: string;
  created_at?: string;
}

export interface SeedCategory {
  id?: string;
  name: string;
  prefix: string;
  default_nursery_weeks?: number; 
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
  custom_nursery_weeks?: number; 
}

export interface SeedlingJournalEntry {
  id: string;
  date: string;
  type: 'UPPOT' | 'FERTILIZE' | 'EVENT' | 'NOTE' | 'ALLOCATE' | 'TASTING' | 'HARVEST' | 'OBSERVATION';
  note: string;
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
  custom_nursery_weeks?: number; 
  journal?: SeedlingJournalEntry[];

  returnTo?: AppView;
  returnPayload?: any;
  newCatName?: string;
  newCatPrefix?: string;
}

export interface TraySeedRecord {
  cell?: number | string;
  seed_id: string;
  sown_count?: number;
  germinated_count?: number;
  planted_count?: number;
  sown_date?: string;        // Added for individual seed dating
  germination_date?: string; // Added for individual seed dating
  planted_date?: string;     // Added for individual seed dating
}

export interface SeedlingTray {
  id: string;
  name?: string; 
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
  seedling_target_date?: string; 
  last_pickup_date?: string;         
  min_nursery_percentage?: number;
  created_at: string;
}

export interface WishlistSession {
  id: string; 
  list_name: string;
  season_id: string;
  expires_at?: string;
  submitted_at?: string;
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
  images?: string[];
  created_at?: string;
  updated_at?: string;
  seed?: InventorySeed;
  season?: Season;
}

export interface GrowPlanRecord {
  id: string;
  season_id: string;
  seed_id: string;
  target_plant_date: string;
  planned_qty: number;
  sown_qty: number;
  tray_sown_qty?: number;
  indoor_start_date: string;
  stratification_started?: boolean; // Added for fridge tracking
  seed?: InventorySeed;
}