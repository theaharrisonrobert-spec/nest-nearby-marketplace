import hero from "@/assets/hero.jpg";

export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
    </div>
  );
}
