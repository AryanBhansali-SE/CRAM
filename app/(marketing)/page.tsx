import { Hero } from "@/components/marketing/Hero";
import { Features } from "@/components/marketing/Features";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Pricing } from "@/components/marketing/Pricing";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { getUser } from "@/lib/auth";

export default async function LandingPage() {
  const authed = (await getUser()) !== null;

  return (
    <>
      <Hero authed={authed} />
      <Features />
      <HowItWorks />
      <Pricing
        authed={authed}
        heading="Start free, upgrade at finals"
        subheading="Every plan opens the full workspace while Cram is in preview."
      />
      <FinalCTA authed={authed} />
    </>
  );
}
