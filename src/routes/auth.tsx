import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthScene } from "@/components/AuthScene";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import type { AccountType } from "@/lib/listings";

type ProfessionalType = "property_owner" | "agent_realtor" | "property_manager" | "caretaker";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode: "signin" | "signup"; next?: string | undefined; type?: AccountType | undefined; googleRole?: boolean } => {
    const next = s["next"];
    const googleRole = s["googleRole"];
    return {
      mode: s["mode"] === "signup" ? "signup" : "signin",
      next: typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : undefined,
      type: s["type"] === "landlord" || s["type"] === "tenant" ? s["type"] : undefined,
      googleRole: googleRole === true || googleRole === "true",
    };
  },
  head: () => ({
    meta: [
      { title: "Sign in or create an account — RentReady" },
      { name: "description", content: "Sign in to RentReady to post properties and manage your listings." },
      { property: "og:title", content: "Sign in — RentReady" },
      { property: "og:description", content: "Create your free RentReady account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

async function notifyAdmin(method: "email" | "google") {
  await supabase.rpc("record_sign_in", { _method: method });
}

function validNigerianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^0[789]\d{9}$/.test(digits) || /^234[789]\d{9}$/.test(digits);
}

function validPassword(value: string) {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

function validProfessionalPassword(value: string) {
  return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9\s]/.test(value);
}

function getConfirmationRedirectUrl() {
  return new URL("/auth/callback", window.location.origin).toString();
}

function AuthPage() {
  const { mode, next, type: selectedType, googleRole = false } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"email" | "password" | "signup" | "professional" | "sent" | "googleRole">("email");
  const [accountRole, setAccountRole] = useState<AccountType>(selectedType === "landlord" ? "landlord" : "tenant");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [professionalType, setProfessionalType] = useState<ProfessionalType | "">("");
  const [phoneExtension, setPhoneExtension] = useState("");
  const [googleRoleType, setGoogleRoleType] = useState<AccountType | null>(null);
  const [signupAddressMayExist, setSignupAddressMayExist] = useState(false);
  const signup = mode === "signup";
  const field = "h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";
  const signInSearch = next ? { mode: "signin" as const, next } : { mode: "signin" as const };

  useEffect(() => {
    const authError = sessionStorage.getItem("rr-auth-error");
    if (authError) {
      sessionStorage.removeItem("rr-auth-error");
      toast.error(authError);
    }
  }, []);

  useEffect(() => {
    setStep(googleRole ? "googleRole" : mode === "signup" && selectedType === "landlord" ? "professional" : "email");
    setAccountRole(selectedType === "landlord" ? "landlord" : "tenant");
    setGoogleRoleType(null);
  }, [mode, selectedType, googleRole]);

  function continueWithEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep(signup ? "signup" : "password");
  }

  function chooseLandlord() {
    setAccountRole("landlord");
    setStep("professional");
  }

  async function redirectByRole(accountType: string | null | undefined) {
    const { data: sessionData } = await supabase.auth.getUser();
    if (sessionData.user && sessionData.user.email?.toLowerCase() !== "rentreadyng@gmail.com") {
      const { data: approval } = await supabase.from("profiles").select("approval_status, is_blocked").eq("id", sessionData.user.id).maybeSingle();
      if (approval?.is_blocked || approval?.approval_status === "pending" || approval?.approval_status === "rejected" || !approval) {
        await navigate({ to: "/approval-status", replace: true });
        return;
      }
    }
    const destination = sessionData.user?.email?.toLowerCase() === "rentreadyng@gmail.com"
      ? "/admin"
      : next ?? (accountType === "landlord" ? " / " : " / ''
    await navigate({ to: destination as "/" | "/dashboard" | "/admin", replace: true });
  }

  async function onLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { toast.error(error.message); return; }
      const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", data.user.id).maybeSingle();
      const role = profile?.account_type ?? (typeof data.user.user_metadata["account_type"] === "string" ? data.user.user_metadata["account_type"] : null);
      await notifyAdmin("email");
      toast.success("Welcome back!");
      await redirectByRole(role);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!validNigerianPhone(phone)) { toast.error("Enter a valid Nigerian phone number"); return; }
    const isProfessional = accountRole === "landlord";
    if (isProfessional && !validProfessionalPassword(password)) { toast.error("Use at least 8 characters with uppercase and lowercase letters, a number, and a special character"); return; }
    if (!isProfessional && !validPassword(password)) { toast.error("Use at least 8 characters with both letters and numbers"); return; }
    if (isProfessional && !professionalType) { toast.error("Select your professional category"); return; }
    if (isProfessional && (!firstName.trim() || !lastName.trim())) { toast.error("Enter your first and last name"); return; }
    if (!isProfessional && !fullName.trim()) { toast.error("Enter your full name"); return; }
    if (isProfessional && phoneExtension && !/^\d{1,6}$/.test(phoneExtension.trim())) { toast.error("Enter a valid phone extension"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getConfirmationRedirectUrl(),
          data: {
            full_name: isProfessional ? `${firstName.trim()} ${lastName.trim()}` : fullName.trim(),
            phone: phone.trim(),
            ...(isProfessional ? { professional_type: professionalType, phone_extension: phoneExtension.trim() || null } : {}),
            role: accountRole,
            account_type: accountRole,
            role_selected: true,
          },
        },
      });
      if (error) { toast.error(error.message); return; }
      if (data.session) {
        await supabase.auth.signOut();
        toast.error("No confirmation email was sent because email confirmation is disabled in Supabase. Enable Confirm email in Authentication → Sign In / Providers → Email, then try a new email address.");
        return;
      }
      setSignupAddressMayExist(data.user?.identities?.length === 0);
      setStep("sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function completeGoogleRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!googleRoleType) { toast.error("Choose Tenant or Landlord"); return; }
    if (!validNigerianPhone(phone)) { toast.error("Enter a valid Nigerian phone number"); return; }
    setBusy(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) { toast.error(authError.message); return; }
      if (!authData.user) { toast.error("Please sign in again"); await navigate({ to: "/auth", search: signInSearch, replace: true }); return; }
      const existingName = authData.user.user_metadata["full_name"] ?? authData.user.user_metadata["name"] ?? null;
      const { error } = await supabase.from("profiles").upsert({
        id: authData.user.id,
        full_name: typeof existingName === "string" ? existingName : null,
        phone: phone.trim(),
        account_type: googleRoleType,
        role_selected: true,
      }, { onConflict: "id" });
      if (error) { toast.error(error.message); return; }
      await supabase.auth.updateUser({ data: { phone: phone.trim(), role: googleRoleType, account_type: googleRoleType } });
      toast.success("Account type saved");
      await navigate({ to: "/approval-status", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not finish setting up your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
  redirectTo: window.location.origin + "/auth/callback",
  queryParams: {
    prompt:"select_account consent",
  },
},
      });
      if (error) toast.error(error.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (busy || !email.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: getConfirmationRedirectUrl() },
      });
      if (error) { toast.error(error.message); return; }
      toast.success("If this address is awaiting confirmation, a new link has been requested. Check your inbox and spam folder.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resend the confirmation link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const passwordField = (label: string, autocomplete: string, short = false) => (
    <div>
      <label htmlFor="auth-password" className="mb-1.5 block text-sm font-semibold">{label}</label>
      <div className="relative">
        <input id="auth-password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={autocomplete} type={showPassword ? "text" : "password"} required minLength={short ? 1 : 8} pattern={short ? undefined : "(?=.*[A-Za-z])(?=.*[0-9]).{8,}"} title={short ? undefined : "Use at least 8 characters with letters and numbers"} placeholder={short ? "Password" : "Create a password"} className={field + " pr-12"} />
        <button type="button" className="absolute right-3 top-3 text-sm font-medium text-slate-600" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
      </div>
      {!short && <p className="mt-1.5 text-xs text-slate-500">At least 8 characters, with letters and numbers.</p>}
    </div>
  );
  const googleButton = <Button onClick={google} type="button" variant="outline" disabled={busy} className="h-12 w-full border-slate-300 bg-white text-base font-semibold text-slate-800 hover:bg-slate-50"><span className="font-display text-lg font-bold text-[#2563EB]" aria-hidden="true">G</span>Continue with Google</Button>;
  const primaryButton = "h-12 w-full bg-[#2563EB] text-base font-semibold text-white hover:bg-[#1D4ED8]";
  const linkClass = "font-semibold text-[#2563EB] underline-offset-2 hover:underline";

  return <AuthScene>
    {step === "googleRole" ? (
      <form onSubmit={completeGoogleRole} className="space-y-4">
        <h1 className="text-3xl font-bold">Create account</h1>
        <p className="text-sm text-slate-600">Choose how you’ll use RentReady.</p>
        <div className="grid grid-cols-2 gap-3">{(["landlord", "tenant"] as const).map((role) => <button key={role} type="button" aria-pressed={googleRoleType === role} onClick={() => setGoogleRoleType(role)} className={`min-h-12 rounded-lg border px-3 text-sm font-semibold ${googleRoleType === role ? "border-[#0B3D2E] bg-[#0B3D2E] text-white" : "border-slate-300 bg-white text-slate-800"}`}>{role === "landlord" ? "Landlord / Property Owner" : "Buyer / Tenant"}</button>)}</div>
        <label className="block text-sm font-semibold" htmlFor="google-phone">Phone number *<input id="google-phone" value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" inputMode="tel" autoComplete="tel" required placeholder="0803..." className={`${field} mt-1.5 font-normal`} /></label>
        <Button type="submit" disabled={busy} className={primaryButton}>{busy ? "Saving…" : "Continue"}</Button>
      </form>
    ) : step === "professional" ? (
      <div>
        <h1 className="text-3xl font-bold">Create professional account</h1>
        <p className="mt-2 text-sm text-slate-600">Create a RentReady account for your property business.</p>
        <form onSubmit={createAccount} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold" htmlFor="professional-email">Email Address *<input id="professional-email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" required placeholder="Email address" className={`${field} mt-1.5 font-normal`} /></label>
          <label className="block text-sm font-semibold" htmlFor="professional-password">Create password *
            <div className="relative mt-1.5"><input id="professional-password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" type={showPassword ? "text" : "password"} required minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s]).{8,}" title="Use at least 8 characters with uppercase and lowercase letters, a number, and a special character" placeholder="Create a password" className={`${field} pr-12 font-normal`} /><button type="button" className="absolute right-3 top-3 text-sm font-medium text-slate-600" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
          </label>
          <p className="-mt-2 text-xs text-slate-500">At least 8 characters, uppercase and lowercase letters, a number, and a special character.</p>
          <label className="block text-sm font-semibold" htmlFor="professional-type">Professional type *<select id="professional-type" required value={professionalType} onChange={(event) => setProfessionalType(event.target.value as ProfessionalType | "")} className={`${field} mt-1.5 font-normal`}><option value="" disabled>Select your category</option><option value="property_owner">Landlord / Property Owner</option><option value="agent_realtor">Agent / Realtor</option><option value="property_manager">Property Manager</option><option value="caretaker">Caretaker</option></select></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold" htmlFor="professional-first-name">First name *<input id="professional-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required placeholder="First name" className={`${field} mt-1.5 font-normal`} /></label>
            <label className="block text-sm font-semibold" htmlFor="professional-last-name">Last name *<input id="professional-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required placeholder="Last name" className={`${field} mt-1.5 font-normal`} /></label>
          </div>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <label className="block text-sm font-semibold" htmlFor="professional-phone">Phone number *<input id="professional-phone" value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" inputMode="tel" autoComplete="tel" required placeholder="0803..." className={`${field} mt-1.5 font-normal`} /></label>
            <label className="block text-sm font-semibold" htmlFor="professional-extension">Ext<input id="professional-extension" value={phoneExtension} onChange={(event) => setPhoneExtension(event.target.value)} inputMode="numeric" maxLength={6} placeholder="Optional" className={`${field} mt-1.5 font-normal`} /></label>
          </div>
          <Button type="submit" disabled={busy} className={primaryButton}>{busy ? "Creating account…" : "Create Account"}</Button>
        </form>
        <button type="button" onClick={() => setStep("email")} className={`mt-5 inline-flex items-center gap-2 text-sm ${linkClass}`}><ArrowLeft className="h-4 w-4" />Back to Buyer / Tenant signup</button>
      </div>
    ) : step === "sent" ? (
      <div>
        <h1 className="text-3xl font-bold">Check your email</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{signupAddressMayExist
          ? <>If <span className="font-semibold text-slate-900">{email.trim()}</span> is still awaiting confirmation, use the button below to request a new link. If you already have an account, sign in or reset your password.</>
          : <>Supabase accepted the signup for <span className="font-semibold text-slate-900">{email.trim()}</span>. A confirmation link should arrive by email. Check your spam folder if you don’t see it.</>}</p>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void resendConfirmation()} className="mt-5 h-12 w-full border-slate-300 text-slate-800">{busy ? "Sending…" : "Resend confirmation link"}</Button>
        <button type="button" onClick={() => setStep("email")} className={`mt-5 inline-flex items-center gap-2 text-sm ${linkClass}`}><ArrowLeft className="h-4 w-4" />Use a different email</button>
      </div>
    ) : step === "password" ? (
      <div>
        <h1 className="text-3xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Continue with {email.trim()}</p>
        <form onSubmit={onLogin} className="mt-6 space-y-4">
          {passwordField("Password *", "current-password", true)}
          <div className="text-right"><Link to="/forgot-password" className={`text-sm ${linkClass}`}>Forgot password?</Link></div>
          <Button type="submit" disabled={busy} className={primaryButton}>{busy ? "Signing in…" : "Log In"}</Button>
        </form>
        <button type="button" onClick={() => setStep("email")} className={`mt-5 inline-flex items-center gap-2 text-sm ${linkClass}`}><ArrowLeft className="h-4 w-4" />Change email</button>
      </div>
    ) : step === "signup" ? (
      <div>
        <h1 className="text-3xl font-bold">Create account</h1>
        <p className="mt-2 text-sm text-slate-600">{email.trim() ? `Finish setting up ${email.trim()}.` : "Enter your details to create a Buyer / Tenant account."}</p>
        <form onSubmit={createAccount} className="mt-6 space-y-4">
          {!email.trim() && <label className="block text-sm font-semibold" htmlFor="buyer-email">Email Address *<input id="buyer-email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" required placeholder="Email address" className={`${field} mt-1.5 font-normal`} /></label>}
          {passwordField("Create password *", "new-password")}
          <label className="block text-sm font-semibold" htmlFor="signup-name">Full Name *<input id="signup-name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required placeholder="Full name" className={`${field} mt-1.5 font-normal`} /></label>
          <label className="block text-sm font-semibold" htmlFor="signup-phone">Phone number *<input id="signup-phone" value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" inputMode="tel" autoComplete="tel" required placeholder="0803..." className={`${field} mt-1.5 font-normal`} /></label>
          <Button type="submit" disabled={busy} className={primaryButton}>{busy ? "Creating account…" : "Create Account"}</Button>
        </form>
        <button type="button" onClick={() => setStep("email")} className={`mt-5 inline-flex items-center gap-2 text-sm ${linkClass}`}><ArrowLeft className="h-4 w-4" />Change email</button>
        <p className="mt-5 text-sm text-slate-600">Have a RentReady account? <button type="button" onClick={() => void navigate({ to: "/auth", search: { mode: "signin", ...(next ? { next } : {}) }, replace: true })} className={linkClass}>Sign in</button></p>
      </div>
    ) : (
      <div>
        <h1 className="text-3xl font-bold">{signup ? "Create account" : "Sign in"}</h1>
        <p className="mt-2 text-sm text-slate-600">{signup ? "Start with your email to create a Buyer / Tenant account." : "Enter your email to continue."}</p>
        <form onSubmit={continueWithEmail} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold" htmlFor="auth-email">Email Address *<input id="auth-email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" required placeholder="Email address" className={`${field} mt-1.5 font-normal`} /></label>
          <Button type="submit" className={primaryButton}>Continue</Button>
        </form>
        <p className="mt-5 text-sm text-slate-600">{signup ? "Have a RentReady account?" : "New to RentReady?"} <button type="button" onClick={() => void navigate({ to: "/auth", search: { mode: signup ? "signin" : "signup", ...(next ? { next } : {}) }, replace: true })} className={linkClass}>{signup ? "Sign in" : "Create account"}</button></p>
        {signup && <div className="mt-4 flex items-center justify-between gap-3 text-sm"><button type="button" onClick={() => { setAccountRole("tenant"); setStep("signup"); }} className={linkClass}>Buyer / Tenant</button><button type="button" onClick={chooseLandlord} className={linkClass}>I am a landlord / professional</button></div>}
        <div className="my-6 flex items-center gap-3 text-xs font-medium text-slate-500"><span className="h-px flex-1 bg-slate-200" />OR<span className="h-px flex-1 bg-slate-200" /></div>
        {googleButton}
        {signup && <p className="mt-5 text-center text-xs leading-5 text-slate-500">By submitting, I accept RentReady&apos;s <Link to="/terms" className={linkClass}>terms of use</Link>.</p>}
      </div>
    )}
  </AuthScene>;
}
