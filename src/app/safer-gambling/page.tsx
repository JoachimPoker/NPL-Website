import { pageMeta } from "@/lib/site";
import { A, H2, LegalPage, UL } from "@/components/LegalPage";

export const metadata = pageMeta({ title: "Safer gambling", description: "Keeping poker fun, and where to get free, confidential help.", path: "/safer-gambling" });

const HELP = [
  { name: "National Gambling Helpline (GamCare)", detail: "Free, confidential support, 24 hours a day.", phone: "0808 8020 133", href: "https://www.gamcare.org.uk" },
  { name: "GambleAware", detail: "Advice, self-assessment and treatment services.", href: "https://www.gambleaware.org" },
  { name: "GAMSTOP", detail: "Exclude yourself from all UK-licensed online gambling sites, for free.", href: "https://www.gamstop.co.uk" },
  { name: "Gamblers Anonymous", detail: "Local and online meetings.", href: "https://www.gamblersanonymous.org.uk" },
];

export default function SaferGamblingPage() {
  return (
    <LegalPage title="Safer gambling" lede="Poker should stay fun. If it isn't, free and confidential help is available, any time." path="/safer-gambling">
      <p>
        The National Poker League is for players aged 18 and over. This site records results; it doesn&apos;t take bets, sell anything or link to betting.
      </p>

      <H2>Keep it fun</H2>
      <UL>
        <li>Set a budget before you play, and only play with money you can afford to lose.</li>
        <li>Decide how long you&apos;ll play, and take breaks.</li>
        <li>Don&apos;t chase losses or play to win money back.</li>
        <li>Don&apos;t play when you&apos;re upset, stressed or have been drinking.</li>
        <li>Keep a balance with work, family and other interests.</li>
      </UL>

      <H2>Signs it may be becoming a problem</H2>
      <UL>
        <li>Spending more money or time than you meant to.</li>
        <li>Borrowing money, or missing bills, to play.</li>
        <li>Hiding how much you play from people close to you.</li>
        <li>Feeling anxious, guilty or irritable about gambling.</li>
      </UL>

      <H2>Get help</H2>
      <ul className="space-y-3">
        {HELP.map((h) => (
          <li key={h.name} className="border border-white/[0.08] bg-[linear-gradient(180deg,#0f3337_0%,#0a2427_100%)] p-4">
            <p className="font-semibold text-season-ink">{h.name}</p>
            <p className="text-[0.9375rem] text-season-ink/80">{h.detail}</p>
            <p className="mt-1 flex flex-wrap gap-x-5 text-[0.9375rem]">
              {h.phone && (
                <a href={`tel:${h.phone.replace(/\s/g, "")}`} className="font-semibold text-season-amber tabular-nums">
                  Call {h.phone}
                </a>
              )}
              <A href={h.href}>{h.href.replace(/^https:\/\/(www\.)?/, "")}</A>
            </p>
          </li>
        ))}
      </ul>
      <p>
        Casinos can also help you set limits or take a break from playing (self-exclusion). Ask the staff at any venue.
      </p>
    </LegalPage>
  );
}
