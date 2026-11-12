import Image from "next/image";

/** Original supplied artwork; never replace this with the separate receipt stamp. */
export function OfficialLogo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return <Image src="/assets/branding/ipsm-logo-original.jpg" alt="IPSM — Institut Professionnel Saint Michel pour les Arts" width={1070} height={1070} priority={priority} sizes="(max-width: 640px) 180px, 220px" className={`h-auto max-w-full object-contain ${className}`} />;
}
