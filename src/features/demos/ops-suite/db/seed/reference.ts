/**
 * Static reference data for the synthetic seed: a generic Indian B2B distributor of industrial supplies
 * (MRO: fasteners, bearings, electrical, safety gear…) selling to manufacturers, builders, hospitals etc.
 * All names are generated combinations; websites/emails use the reserved `.example` TLD.
 */

export type Region = "north" | "south" | "east" | "west" | "central" | "north_east";

export interface City {
  city: string;
  state: string;
  region: Region;
  gstCode: string; // GST state code (first two digits of a GSTIN)
  weight: number; // relative business density
}

export const CITIES: City[] = [
  { city: "Chennai", state: "Tamil Nadu", region: "south", gstCode: "33", weight: 9 },
  { city: "Coimbatore", state: "Tamil Nadu", region: "south", gstCode: "33", weight: 5 },
  { city: "Hosur", state: "Tamil Nadu", region: "south", gstCode: "33", weight: 3 },
  { city: "Bengaluru", state: "Karnataka", region: "south", gstCode: "29", weight: 9 },
  { city: "Mysuru", state: "Karnataka", region: "south", gstCode: "29", weight: 2 },
  { city: "Hyderabad", state: "Telangana", region: "south", gstCode: "36", weight: 7 },
  { city: "Visakhapatnam", state: "Andhra Pradesh", region: "south", gstCode: "37", weight: 3 },
  { city: "Kochi", state: "Kerala", region: "south", gstCode: "32", weight: 3 },
  { city: "Mumbai", state: "Maharashtra", region: "west", gstCode: "27", weight: 9 },
  { city: "Pune", state: "Maharashtra", region: "west", gstCode: "27", weight: 8 },
  { city: "Nashik", state: "Maharashtra", region: "west", gstCode: "27", weight: 3 },
  { city: "Ahmedabad", state: "Gujarat", region: "west", gstCode: "24", weight: 7 },
  { city: "Surat", state: "Gujarat", region: "west", gstCode: "24", weight: 4 },
  { city: "Vadodara", state: "Gujarat", region: "west", gstCode: "24", weight: 4 },
  { city: "Rajkot", state: "Gujarat", region: "west", gstCode: "24", weight: 3 },
  { city: "New Delhi", state: "Delhi", region: "north", gstCode: "07", weight: 7 },
  { city: "Gurugram", state: "Haryana", region: "north", gstCode: "06", weight: 6 },
  { city: "Faridabad", state: "Haryana", region: "north", gstCode: "06", weight: 4 },
  { city: "Noida", state: "Uttar Pradesh", region: "north", gstCode: "09", weight: 5 },
  { city: "Lucknow", state: "Uttar Pradesh", region: "north", gstCode: "09", weight: 3 },
  { city: "Kanpur", state: "Uttar Pradesh", region: "north", gstCode: "09", weight: 3 },
  { city: "Ludhiana", state: "Punjab", region: "north", gstCode: "03", weight: 4 },
  { city: "Jaipur", state: "Rajasthan", region: "north", gstCode: "08", weight: 4 },
  { city: "Indore", state: "Madhya Pradesh", region: "central", gstCode: "23", weight: 4 },
  { city: "Bhopal", state: "Madhya Pradesh", region: "central", gstCode: "23", weight: 2 },
  { city: "Nagpur", state: "Maharashtra", region: "central", gstCode: "27", weight: 3 },
  { city: "Raipur", state: "Chhattisgarh", region: "central", gstCode: "22", weight: 2 },
  { city: "Kolkata", state: "West Bengal", region: "east", gstCode: "19", weight: 6 },
  { city: "Bhubaneswar", state: "Odisha", region: "east", gstCode: "21", weight: 3 },
  { city: "Jamshedpur", state: "Jharkhand", region: "east", gstCode: "20", weight: 3 },
  { city: "Patna", state: "Bihar", region: "east", gstCode: "10", weight: 2 },
  { city: "Guwahati", state: "Assam", region: "north_east", gstCode: "18", weight: 2 },
];

export const WAREHOUSES: { code: string; name: string; city: string; state: string; serves: Region[] }[] = [
  { code: "CHN-01", name: "Chennai DC (Sriperumbudur)", city: "Chennai", state: "Tamil Nadu", serves: ["south"] },
  { code: "BHW-01", name: "Mumbai DC (Bhiwandi)", city: "Bhiwandi", state: "Maharashtra", serves: ["west", "central"] },
  { code: "GGN-01", name: "Delhi NCR DC (Gurugram)", city: "Gurugram", state: "Haryana", serves: ["north"] },
  { code: "KOL-01", name: "Kolkata DC (Dankuni)", city: "Kolkata", state: "West Bengal", serves: ["east", "north_east"] },
];

export const USERS = [
  { name: "Demo Admin", email: "admin@ops-suite.example", role: "admin" },
  { name: "Riya Mehta", email: "riya.mehta@ops-suite.example", role: "sales" },
  { name: "Arjun Nair", email: "arjun.nair@ops-suite.example", role: "sales" },
  { name: "Rahul Verma", email: "rahul.verma@ops-suite.example", role: "sales" },
  { name: "Sneha Kulkarni", email: "sneha.kulkarni@ops-suite.example", role: "sales" },
  { name: "Imran Shaikh", email: "imran.shaikh@ops-suite.example", role: "sales" },
  { name: "Divya Reddy", email: "divya.reddy@ops-suite.example", role: "sales" },
  { name: "Kavya Iyer", email: "kavya.iyer@ops-suite.example", role: "warehouse" },
  { name: "Manoj Yadav", email: "manoj.yadav@ops-suite.example", role: "warehouse" },
] as const;

export type Industry =
  | "manufacturing"
  | "construction"
  | "automotive"
  | "pharma"
  | "food_processing"
  | "textiles"
  | "logistics"
  | "retail"
  | "hospitality"
  | "healthcare"
  | "education"
  | "energy";

/** Weight = share of the customer base; words = name endings typical for the industry. */
export const INDUSTRIES: Record<Industry, { weight: number; words: string[] }> = {
  manufacturing: { weight: 18, words: ["Precision Components", "Engineering Works", "Industries", "Fabricators", "Machine Tools"] },
  construction: { weight: 11, words: ["Infra Projects", "Builders", "Constructions", "Infrastructure"] },
  automotive: { weight: 12, words: ["Auto Components", "Autoparts", "Motors", "Forgings"] },
  pharma: { weight: 7, words: ["Pharmaceuticals", "Life Sciences", "Formulations"] },
  food_processing: { weight: 8, words: ["Foods", "Agro Products", "Dairy", "Beverages"] },
  textiles: { weight: 7, words: ["Textiles", "Spinning Mills", "Fabrics", "Apparels"] },
  logistics: { weight: 7, words: ["Logistics", "Freight Movers", "Warehousing", "Cargo Services"] },
  retail: { weight: 6, words: ["Retail", "Hypermart", "Traders", "Stores"] },
  hospitality: { weight: 5, words: ["Hotels", "Hospitality", "Resorts"] },
  healthcare: { weight: 6, words: ["Hospitals", "Diagnostics", "Medicare"] },
  education: { weight: 4, words: ["Educational Trust", "Institute of Technology", "Academy"] },
  energy: { weight: 7, words: ["Power", "Solar Energy", "Renewables", "Energy Systems"] },
};

export const NAME_PREFIXES = [
  "Shree", "Sri", "Om", "Jai", "Vijay", "Ganesh", "Lakshmi", "Bharat", "Hind", "Deccan", "Kaveri", "Narmada",
  "Sahyadri", "Himalaya", "Coromandel", "Konkan", "Malabar", "Ashoka", "Surya", "Navkar", "Patel", "Mehta",
  "Agarwal", "Reddy", "Iyer", "Shah", "Kapoor", "Bansal", "Goyal", "Menon", "Nair", "Rao", "Jain", "Sinha",
  "Chawla", "Kirloskar Nagar", "Vindhya", "Aravali", "Godavari", "Tapti", "Sabari", "Pragati", "Unnati",
  "Sanjivani", "Akshay", "Trident", "Apex", "Pinnacle", "Zenith", "Vertex", "Orbit", "Nova", "Prime", "Unique",
];

export const COMPANY_SUFFIXES = [
  { value: "Pvt Ltd", weight: 60 },
  { value: "Ltd", weight: 10 },
  { value: "LLP", weight: 15 },
  { value: "& Co.", weight: 5 },
  { value: "", weight: 10 },
];

export const SUPPLIER_WORDS = [
  "Industrial Supplies", "Trading Co.", "Hardware Mart", "Engineering Stores", "Bearings House", "Electricals",
  "Packaging Solutions", "Lubricants", "Fasteners", "Safety Products", "Tools Corporation", "Hydraulics",
];

export const CONTACT_TITLES = [
  "Purchase Manager", "Procurement Head", "Plant Manager", "Maintenance Head", "Director", "Managing Director",
  "Stores In-charge", "Accounts Manager", "Operations Manager", "Project Engineer", "Facility Manager", "CFO",
];

export type Size = "micro" | "small" | "medium" | "large" | "enterprise";

/** ₹ ranges by company size: annual revenue, deal value, repeat order value, repeat orders per year. */
export const SIZES: Record<
  Size,
  { weight: number; revenue: [number, number]; deal: [number, number]; order: [number, number]; ordersPerYear: [number, number]; contacts: [number, number] }
> = {
  micro: { weight: 22, revenue: [5e6, 5e7], deal: [5e4, 3e5], order: [8e3, 6e4], ordersPerYear: [2, 6], contacts: [1, 2] },
  small: { weight: 32, revenue: [5e7, 5e8], deal: [2e5, 1.2e6], order: [2.5e4, 1.5e5], ordersPerYear: [4, 10], contacts: [1, 3] },
  medium: { weight: 26, revenue: [5e8, 2.5e9], deal: [8e5, 4e6], order: [6e4, 4e5], ordersPerYear: [6, 16], contacts: [2, 4] },
  large: { weight: 14, revenue: [2.5e9, 1e10], deal: [2.5e6, 1.2e7], order: [1.5e5, 9e5], ordersPerYear: [10, 24], contacts: [3, 5] },
  enterprise: { weight: 6, revenue: [1e10, 1e11], deal: [8e6, 4e7], order: [4e5, 2.5e6], ordersPerYear: [16, 36], contacts: [4, 6] },
};

export type Category =
  | "fasteners"
  | "bearings"
  | "electrical"
  | "hydraulics"
  | "safety"
  | "packaging"
  | "tools"
  | "pipes_fittings"
  | "lubricants"
  | "adhesives";

export type Unit = "pcs" | "box" | "kg" | "litre" | "metre" | "set" | "roll";

interface ProductTemplate {
  name: string;
  variants?: string[];
  unit: Unit;
  price: [number, number]; // ₹ ex-GST per unit
  gst?: number;
  hsn?: string;
}

/** Catalogue templates. Every template × variant becomes one SKU (~150 in total). */
export const CATALOGUE: Record<Category, { sku: string; label: string; gst: number; hsn: string; items: ProductTemplate[] }> = {
  fasteners: {
    sku: "FAS", label: "Fasteners", gst: 18, hsn: "7318",
    items: [
      { name: "Hex bolt SS304", variants: ["M8×40", "M10×50", "M12×60", "M16×80"], unit: "box", price: [450, 2400] },
      { name: "Socket head cap screw 12.9", variants: ["M6×25", "M8×30", "M10×40"], unit: "box", price: [380, 1600] },
      { name: "Hex nut zinc plated", variants: ["M8", "M10", "M12", "M16"], unit: "box", price: [180, 900] },
      { name: "Plain washer", variants: ["M8", "M12", "M16"], unit: "box", price: [120, 520] },
      { name: "Anchor fastener sleeve type", variants: ["M10×75", "M12×100"], unit: "box", price: [650, 1800] },
      { name: "Self-tapping screw pan head", variants: ["4.2×19", "4.8×25"], unit: "box", price: [160, 420] },
    ],
  },
  bearings: {
    sku: "BRG", label: "Bearings", gst: 18, hsn: "8482",
    items: [
      { name: "Deep groove ball bearing", variants: ["6204 2RS", "6205 2RS", "6206 2RS", "6305 ZZ", "6308 ZZ"], unit: "pcs", price: [110, 950] },
      { name: "Taper roller bearing", variants: ["30205", "30208", "32210"], unit: "pcs", price: [420, 2200] },
      { name: "Pillow block bearing", variants: ["UCP205", "UCP208", "UCP212"], unit: "pcs", price: [520, 2600] },
      { name: "Spherical roller bearing", variants: ["22210 E", "22216 E"], unit: "pcs", price: [2800, 7800] },
    ],
  },
  electrical: {
    sku: "ELC", label: "Electrical", gst: 18, hsn: "8536",
    items: [
      { name: "FR PVC copper cable (90 m)", variants: ["1.5 sq mm", "2.5 sq mm", "4 sq mm", "6 sq mm"], unit: "roll", price: [1450, 6200], hsn: "8544" },
      { name: "MCB C-curve", variants: ["6A SP", "16A SP", "32A DP", "63A TP"], unit: "pcs", price: [190, 2400] },
      { name: "RCCB 30 mA", variants: ["40A 2P", "63A 4P"], unit: "pcs", price: [1600, 4200] },
      { name: "LED floodlight", variants: ["50 W", "100 W", "200 W"], unit: "pcs", price: [1100, 5200], hsn: "9405" },
      { name: "Power contactor AC3", variants: ["25A", "40A", "65A"], unit: "pcs", price: [1400, 4800] },
      { name: "Industrial plug & socket IP67", variants: ["16A 3P", "32A 5P"], unit: "set", price: [650, 1900] },
    ],
  },
  hydraulics: {
    sku: "HYD", label: "Hydraulics", gst: 18, hsn: "8481",
    items: [
      { name: "Hydraulic hose 2SN", variants: ['3/8"', '1/2"', '3/4"'], unit: "metre", price: [180, 520], hsn: "4009" },
      { name: "Ball valve forged brass", variants: ['1/2"', '1"', '2"'], unit: "pcs", price: [320, 2100] },
      { name: "Gear pump", variants: ["8 cc/rev", "16 cc/rev"], unit: "pcs", price: [6800, 12500], hsn: "8413" },
      { name: "Pressure gauge glycerine-filled", variants: ["0–100 bar", "0–250 bar"], unit: "pcs", price: [520, 980], hsn: "9026" },
      { name: "Hydraulic cylinder double-acting", variants: ["50 bore × 200 stroke", "80 bore × 300 stroke"], unit: "pcs", price: [9500, 24000], hsn: "8412" },
    ],
  },
  safety: {
    sku: "SAF", label: "Safety gear", gst: 18, hsn: "6506",
    items: [
      { name: "Safety helmet ISI ratchet", variants: ["White", "Yellow", "Blue"], unit: "pcs", price: [160, 340] },
      { name: "Nitrile gloves (box of 100)", variants: ["M", "L", "XL"], unit: "box", price: [520, 780], gst: 12, hsn: "4015" },
      { name: "Cut-resistant gloves level 5", unit: "pcs", price: [210, 380], gst: 12, hsn: "6116" },
      { name: "Safety shoes steel toe", variants: ["Size 7", "Size 8", "Size 9", "Size 10"], unit: "pcs", price: [950, 2200], hsn: "6403" },
      { name: "Full-body harness double lanyard", unit: "pcs", price: [2100, 4800], hsn: "6307" },
      { name: "Reflective safety vest", unit: "pcs", price: [95, 260], gst: 12, hsn: "6307" },
      { name: "Anti-fog safety goggles", unit: "pcs", price: [120, 380], hsn: "9004" },
    ],
  },
  packaging: {
    sku: "PKG", label: "Packaging", gst: 18, hsn: "3923",
    items: [
      { name: "Corrugated box 5-ply", variants: ["12×10×8 in", "18×12×12 in", "24×18×18 in"], unit: "pcs", price: [28, 140], gst: 12, hsn: "4819" },
      { name: "Stretch wrap film 23 micron", unit: "roll", price: [480, 820], hsn: "3920" },
      { name: "BOPP tape 48 mm × 65 m", unit: "box", price: [1100, 1650], hsn: "3919" },
      { name: "Bubble wrap roll 1 m × 100 m", unit: "roll", price: [850, 1500] },
      { name: "PP strapping roll 12 mm", unit: "roll", price: [620, 1100] },
      { name: "Wooden pallet 1200×1000", unit: "pcs", price: [750, 1600], gst: 12, hsn: "4415" },
    ],
  },
  tools: {
    sku: "TLS", label: "Tools", gst: 18, hsn: "8204",
    items: [
      { name: "Combination spanner set 6–32 mm", unit: "set", price: [1250, 3600] },
      { name: "Angle grinder", variants: ['4" 850 W', '7" 2200 W'], unit: "pcs", price: [2400, 7800], hsn: "8467" },
      { name: "Cordless drill driver 18 V", unit: "pcs", price: [5800, 11500], hsn: "8467" },
      { name: "Torque wrench", variants: ["20–100 Nm", "40–200 Nm"], unit: "pcs", price: [3200, 8900] },
      { name: "Digital vernier caliper 150 mm", unit: "pcs", price: [1350, 3800], hsn: "9017" },
      { name: "Pipe wrench heavy duty", variants: ['14"', '18"', '24"'], unit: "pcs", price: [520, 1900] },
      { name: "Cutting disc 4\" (pack of 25)", unit: "box", price: [380, 720], hsn: "6804" },
    ],
  },
  pipes_fittings: {
    sku: "PIP", label: "Pipes & fittings", gst: 18, hsn: "7306",
    items: [
      { name: "GI pipe medium class (6 m)", variants: ['1/2"', '1"', '2"'], unit: "pcs", price: [620, 2600] },
      { name: "MS ERW pipe (6 m)", variants: ['1"', '2"', '3"'], unit: "pcs", price: [780, 3400] },
      { name: "CPVC pipe SDR 11 (3 m)", variants: ['1/2"', '1"'], unit: "pcs", price: [190, 520], hsn: "3917" },
      { name: "HDPE pipe PE100", variants: ["63 mm", "110 mm"], unit: "metre", price: [140, 420], hsn: "3917" },
      { name: "GI elbow 90°", variants: ['1/2"', '1"', '2"'], unit: "pcs", price: [35, 210], hsn: "7307" },
      { name: "Slip-on flange ASA 150", variants: ['2"', '4"'], unit: "pcs", price: [380, 1100], hsn: "7307" },
    ],
  },
  lubricants: {
    sku: "LUB", label: "Lubricants", gst: 18, hsn: "2710",
    items: [
      { name: "Hydraulic oil ISO VG", variants: ["46 (20 L)", "68 (20 L)"], unit: "pcs", price: [3200, 4600] },
      { name: "Gear oil EP 90 (20 L)", unit: "pcs", price: [3600, 5200] },
      { name: "Lithium grease EP2 (18 kg)", unit: "pcs", price: [3900, 5600], hsn: "3403" },
      { name: "Soluble cutting oil (20 L)", unit: "pcs", price: [2900, 4300], hsn: "3403" },
      { name: "Compressor oil synthetic (5 L)", unit: "pcs", price: [2400, 4100] },
      { name: "Anti-rust spray 400 ml", unit: "pcs", price: [210, 390], hsn: "3403" },
    ],
  },
  adhesives: {
    sku: "ADH", label: "Adhesives & sealants", gst: 18, hsn: "3506",
    items: [
      { name: "Epoxy adhesive 2-part (1 kg)", unit: "set", price: [980, 2100] },
      { name: "Instant adhesive cyanoacrylate 20 g", unit: "pcs", price: [140, 320] },
      { name: "Threadlocker medium strength 50 ml", unit: "pcs", price: [520, 980] },
      { name: "Neutral-cure silicone sealant 300 ml", unit: "pcs", price: [210, 430], hsn: "3214" },
      { name: "Contact adhesive (5 L)", unit: "pcs", price: [1800, 3200] },
      { name: "Anaerobic gasket maker 50 ml", unit: "pcs", price: [480, 890] },
    ],
  },
};

export const DEAL_TITLES = [
  "Annual {cat} rate contract",
  "{cat} for new plant line",
  "MRO supplies — {q}",
  "{cat} AMC renewal",
  "Plant shutdown kit — {cat}",
  "{cat} standardisation across sites",
  "Bulk {cat} order — {q}",
  "{cat} for expansion project",
];

export const LOST_REASONS = [
  "Price too high",
  "Chose competitor",
  "Budget frozen",
  "No decision made",
  "Delivery timeline too long",
  "Stayed with incumbent supplier",
];

export const ACTIVITY_SUBJECTS = {
  call: ["Discovery call", "Follow-up call on quote", "Pricing discussion", "Call with plant head", "Payment follow-up call"],
  email: ["Sent revised quotation", "Shared product catalogue", "Sent technical datasheets", "Emailed rate contract draft", "Sent PO acknowledgement"],
  meeting: ["Site visit", "Plant walkthrough", "Negotiation meeting", "Quarterly business review", "Product demo at site"],
  note: ["Buyer prefers 45-day credit", "Competitor quoted 6% lower", "New procurement head joined", "Plans second line next quarter", "Needs ISI-marked items only"],
  task: ["Prepare quotation", "Send samples", "Arrange credit approval", "Update price list", "Schedule site visit"],
} as const;

export const TAGS = [
  { name: "key-account", color: "#4ade80" },
  { name: "government", color: "#a0c4ff" },
  { name: "msme", color: "#e8e0d0" },
  { name: "at-risk", color: "#f87171" },
  { name: "new-logo", color: "#fbbf24" },
  { name: "export", color: "#c4b5fd" },
  { name: "strategic", color: "#2dd4bf" },
  { name: "gem-portal", color: "#93c5fd" },
];

export const IMPORT_ERRORS: Record<string, string[]> = {
  leads: ["Invalid email address", "Missing company name", "Phone number must have 10 digits", "Duplicate of an existing lead", "Unknown city"],
  products: ["Unknown SKU", "Price must be a positive number", "GST rate must be 5, 12, 18 or 28", "Missing HSN code"],
  invoices: ["Invoice number not found", "Amount exceeds invoice balance", "Invalid date format (expected YYYY-MM-DD)"],
  inventory: ["Unknown SKU", "Quantity must be a non-negative integer", "Unknown warehouse code"],
};
