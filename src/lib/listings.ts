import type { Database } from "@/integrations/supabase/types";
import apartment from "@/assets/apartment.jpg";
import shop from "@/assets/shop.jpg";
import mall from "@/assets/mall.jpg";
import office from "@/assets/office.jpg";
import land from "@/assets/land.jpg";
import warehouse from "@/assets/warehouse.jpg";
import hall from "@/assets/hall.jpg";
import hero from "@/assets/hero.jpg";

type Row = Database["public"]["Tables"]["listings"]["Row"];
export type Listing = Omit<Row, "contact_phone" | "address" | "promotion_requested">;

/** Public columns only — phone and exact address are never readable by visitors. */
export const LISTING_COLS =
  "id, owner_id, title, description, category, purpose, price, price_period, negotiable, state, city, bedrooms, bathrooms, size_sqft, image_url, contact_name, created_at, status, is_sample, sponsored, details_reviewed, landmarks, amenities, show_address";

export const AMENITIES = ["Furnished", "24/7 Security", "Constant Power", "Borehole Water", "Parking Space", "Swimming Pool", "Gym", "Good Access Road", "Air Conditioning", "Fitted Kitchen"];

export const ACCOUNT_TYPES = {
  landlord: { label: "Landlord / Property Owner", short: "Landlord" },
  tenant: { label: "Buyer / Tenant", short: "Buyer / Tenant" },
} as const;
export type AccountType = keyof typeof ACCOUNT_TYPES;

export const CATEGORIES = [
  { name: "Apartments", sub: "For Rent & Sale", img: apartment },
  { name: "Houses", sub: "Duplexes & bungalows", img: hero },
  { name: "Shops", sub: "For Rent & Sale", img: shop },
  { name: "Malls", sub: "Mall units & plazas", img: mall },
  { name: "Office Spaces", sub: "For Rent & Sale", img: office },
  { name: "Event Halls", sub: "For Rent", img: hall },
  { name: "Land", sub: "For Sale & Lease", img: land },
  { name: "Other Spaces", sub: "Warehouses & more", img: warehouse },
] as const;

export const STATES = [
  "Abia","Abuja","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara",
];

export const POPULAR_AREAS = [
  { state: "Lagos", city: "Lekki" },
  { state: "Lagos", city: "Ikeja" },
  { state: "Lagos", city: "Yaba" },
  { state: "Lagos", city: "Victoria Island" },
  { state: "Lagos", city: "Surulere" },
  { state: "Lagos", city: "Ajah" },
  { state: "Abuja", city: "" },
  { state: "Rivers", city: "Port Harcourt" },
  { state: "Oyo", city: "Ibadan" },
  { state: "Kano", city: "Kano" },
  { state: "Ogun", city: "" },
  { state: "Enugu", city: "" },
];

export const PRICE_RANGES = [
  { label: "Any Price", min: undefined, max: undefined },
  { label: "Under ₦500k", min: undefined, max: 500000 },
  { label: "₦500k – ₦2M", min: 500000, max: 2000000 },
  { label: "₦2M – ₦10M", min: 2000000, max: 10000000 },
  { label: "₦10M – ₦50M", min: 10000000, max: 50000000 },
  { label: "Above ₦50M", min: 50000000, max: undefined },
] as const;

export const PERIODS: Record<string, string> = {
  once: "",
  year: "/ year",
  month: "/ month",
  week: "/ week",
  day: "/ day",
};

export function formatNaira(n: number) {
  return "₦" + Number(n).toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

export function listingImage(l: Pick<Listing, "image_url" | "category">) {
  if (l.image_url) return l.image_url;
  return CATEGORIES.find((c) => c.name === l.category)?.img ?? apartment;
}

export function whatsappLink(phone: string, title: string) {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = "234" + p.slice(1);
  return `https://wa.me/${p}?text=${encodeURIComponent(`Hello, I found your listing "${title}" on RentReady. Is it still available?`)}`;
}
