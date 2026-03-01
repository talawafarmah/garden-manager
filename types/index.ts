export interface SeedData {
  variety_name?: string;
  vendor?: string;
  days_to_maturity?: number | string;
  species?: string;
  category?: string;
  notes?: string;
  companion_plants?: string[];
  cold_stratification?: boolean;
  stratification_days?: number | string;
  light_required?: boolean;
  germination_days?: string;
  seed_depth?: string;
  plant_spacing?: string;
  row_spacing?: string;
  sunlight?: string;
  lifecycle?: string;
  scoville_rating?: number | string; 
  tomato_type: string;
  returnTo?: string;
  returnPayload?: any;
}

export interface InventorySeed {
  id: string;
  category: string;
  variety_name: string;
  vendor: string;
  days_to_maturity: number | string;
  species: string;
  notes: string;
  images: string[];
  primaryImageIndex: number;
  companion_plants: string[];
  cold_stratification: boolean;
  stratification_days: number | string;
  light_required: boolean;
  germination_days: string;
  seed_depth: string;
  plant_spacing: string;
  row_spacing: string;
  out_of_stock: boolean; 
  sunlight: string;
  lifecycle: string;
  thumbnail?: string; 
  scoville_rating?: number | string; 
  tomato_type: string;
  returnTo?: string;
  returnPayload?: any;
}

export interface SeedCategory {
  name: string;
  prefix: string;
}

export interface TraySeedRecord {
  seed_id: string; 
  variety_name: string; 
  sown_count: number;
  germinated_count: number;
  planted_count: number;
  germination_date: string; 
}

export interface SeedlingTray {
  id?: string;
  name: string; 
  tray_type: string; 
  sown_date: string; 
  first_germination_date?: string; 
  first_planted_date?: string;     
  heat_mat: boolean;
  humidity_dome: boolean;          
  grow_light: boolean;             
  potting_mix?: string;            
  location?: string;               
  notes: string;
  images: string[];
  thumbnail?: string; // NEW: Thumbnail for the list view
  contents: TraySeedRecord[];
}

export type AppView = 'dashboard' | 'scanner' | 'importer' | 'vault' | 'seed_detail' | 'seed_edit' | 'trays' | 'tray_detail' | 'tray_edit';