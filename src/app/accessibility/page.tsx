import { pageMeta } from "@/lib/site";
import { A, H2, LegalPage, UL } from "@/components/LegalPage";

export const metadata = pageMeta({ title: "Accessibility", description: "How accessible this site is, and how to report a problem.", path: "/accessibility" });

export default function AccessibilityPage() {
  return (
    <LegalPage title="Accessibility" lede="We want everyone to be able to use this site, whatever device or assistive technology they use." path="/accessibility">
      <H2>What we aim for</H2>
      <p>We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. You should be able to:</p>
      <UL>
        <li>use the whole site with a keyboard, with a visible focus outline;</li>
        <li>use it with a screen reader, with a &ldquo;skip to content&rdquo; link on every page;</li>
        <li>zoom text up to 200% without losing content;</li>
        <li>use it on a phone in either orientation;</li>
        <li>read it with motion reduced, if your device asks for that.</li>
      </UL>

      <H2>Known limitations</H2>
      <UL>
        <li>Charts (the race chart and points charts) are visual. The same figures are in the tables beside them, and each chart has a text summary for screen readers.</li>
        <li>The season calendar&apos;s year ribbon is visual. Every festival and event in it is also listed month by month below it.</li>
        <li>Series and league logos are images supplied by the organisers; their names are given as text alternatives.</li>
        <li>The league&apos;s terms are PDF documents published by the promoter and may not be fully accessible. Their main points are summarised on the <A href="/about">About</A>{" "}page.</li>
      </UL>

      <H2>Report a problem</H2>
      <p>
        If something on the site doesn&apos;t work for you, please <A href="/contact">tell us</A>{" "}which page and what happened. We&apos;ll try to fix it, or get you
        the information another way.
      </p>
    </LegalPage>
  );
}
