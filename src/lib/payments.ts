import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type RentReadyPaidPlan = "landlord_premium" | "tenant_premium" | "blue_tick_monthly" | "boost_post";

export async function startPaidPlan(plan: RentReadyPaidPlan, listingId?: string) {
  const unavailableMessage = "Payment service is unavailable right now. Please try again later.";
  try {
    const { data, error } = await supabase.functions.invoke("create-paystack-checkout", {
      body: { plan, ...(listingId ? { listing_id: listingId } : {}) },
    });
    if (error) {
      toast.error(unavailableMessage);
      return;
    }
    if (!data || typeof data.authorization_url !== "string") {
      toast.error(unavailableMessage);
      return;
    }
    window.location.assign(data.authorization_url);
  } catch {
    toast.error(unavailableMessage);
  }
}

export async function cancelPaidPlan(plan: "landlord_premium" | "tenant_premium") {
  const { data, error } = await supabase.functions.invoke("cancel-paystack-subscription", { body: { plan } });
  if (error) { toast.error(error.message || "Could not cancel subscription renewal."); return false; }
  if (data?.error) { toast.error(data.error); return false; }
  toast.success("Auto-renewal cancelled. Premium access remains until the current paid period ends.");
  return true;
}

export async function startTenantPremiumCheckout() {
  const { data, error } = await supabase.functions.invoke("create-tenant-premium-checkout", { body: {} });
  if (error) {
    toast.error(error.message || "Tenant Premium checkout is unavailable. Please try again later.");
    return;
  }
  if (!data || typeof data.authorization_url !== "string") {
    toast.error(data?.error || "Tenant Premium checkout is not configured yet. Please contact RentReady support.");
    return;
  }
  window.location.assign(data.authorization_url);
}

export async function cancelTenantPremium() {
  const { data, error } = await supabase.functions.invoke("cancel-tenant-premium", { body: {} });
  if (error) {
    toast.error(error.message || "Could not cancel Tenant Premium renewal.");
    return false;
  }
  if (data?.error) {
    toast.error(data.error);
    return false;
  }
  toast.success("Auto-renewal cancelled. Premium access remains until the current paid period ends.");
  return true;
}
