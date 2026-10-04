import { pageMeta } from "@/lib/site";
import { A, H2, LegalPage, Operator, UL } from "@/components/LegalPage";

export const metadata = pageMeta({ title: "Terms of use", description: "The terms for using this site.", path: "/terms" });

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" lede="By using this site you agree to these terms." path="/terms">
      <H2>About this site</H2>
      <p>
        This site is the public record of the National Poker League&apos;s results, standings and records. It is built with the league&apos;s endorsement but is
        run independently: it isn&apos;t operated by Grosvenor Casinos Limited, which promotes the league, or by any casino or series organiser.
      </p>
      <Operator />
      <p>This site is for people aged 18 and over. It doesn&apos;t take bets, sell anything or link to betting.</p>

      <H2>Accuracy</H2>
      <p>
        Results come from the league&apos;s weekly points report and are updated after each one. We work to keep them accurate, but the site can contain errors or
        be behind the latest report. The official league table is published by the promoter, including in the Poker Live app, and the{" "}
        <A href="/about">league&apos;s terms</A>{" "}decide every standing and prize. If something looks wrong, please <A href="/contact">tell us</A>.
      </p>

      <H2>Names and logos</H2>
      <p>
        The National Poker League, NPL Events, Grosvenor, GUKPT, UKPL, 888poker and the other series and league names and logos belong to their owners and are
        used to identify the league&apos;s events. Generated photographs on this site are illustrations, not photos of real venues or people.
      </p>

      <H2>Using the site</H2>
      <UL>
        <li>You may view and share pages for personal, non-commercial use.</li>
        <li>Don&apos;t copy, scrape or republish the data in bulk, or use automated tools that put load on the site.</li>
        <li>Don&apos;t try to get into the admin area or interfere with how the site works.</li>
      </UL>

      <H2>Links</H2>
      <p>We link to other sites, such as support organisations and the league terms. We aren&apos;t responsible for their content.</p>

      <H2>Liability</H2>
      <p>
        The site is provided as it is, free of charge. We aren&apos;t liable for losses from relying on it, as far as the law allows. Nothing in these terms limits
        liability that can&apos;t be limited by law.
      </p>

      <H2>Changes and law</H2>
      <p>We may update these terms; the date above shows the latest version. These terms are governed by the law of England and Wales.</p>
    </LegalPage>
  );
}
