import { Hero } from "@/components/marketing/Hero";
import { Features } from "@/components/marketing/Features";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Pricing } from "@/components/marketing/Pricing";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { getUser } from "@/lib/auth";
import { anonymousTrialEnabled } from "@/lib/auth-shared";

export default async function LandingPage() {
  const user = await getUser();
  // Someone in the anonymous preview is signed in but hasn't signed *up*, so the
  // calls to action still point at creating an account.
  const authed = !!user && !user.is_anonymous;

  return (
    <>
      <Hero authed={authed} trialEnabled={anonymousTrialEnabled() && !user} />
      <Features />
      <HowItWorks />
      <Pricing
        authed={authed}
        heading="Start free, upgrade at finals"
        subheading="Three documents and ten questions a day on the free plan — no card needed."
      />
      <FinalCTA authed={authed} />
    </>
  );
}
