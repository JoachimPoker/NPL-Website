import { pageMeta } from "@/lib/site";
import { LEGAL } from "@/lib/legal";
import { A, H2, LegalPage, Operator, UL } from "@/components/LegalPage";

export const metadata = pageMeta({ title: "Privacy & cookies", description: "What personal data this site holds, where it comes from, and your rights.", path: "/privacy" });

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy & cookies" lede="What personal data this site holds, where it comes from, how it's used, and how to have your name removed." path="/privacy">
      <H2>Who we are</H2>
      <p>
        This site is the public record of the National Poker League. It is run independently of Grosvenor Casinos Limited, which promotes the league. We are
        responsible for the personal data on this site.
      </p>
      <Operator />
      <p>
        To contact us about your data, use the <A href="/contact">contact form</A>
        {LEGAL.email ? (
          <>
            {" "}or email <A href={`mailto:${LEGAL.email}`}>{LEGAL.email}</A>
          </>
        ) : null}
        .
      </p>

      <H2>Players&apos; data</H2>
      <p>The league&apos;s weekly points report, provided by the promoter, is the source of every result on this site. From it we publish:</p>
      <UL>
        <li>your name, or only your initials if you haven&apos;t agreed to show your name;</li>
        <li>the events you cashed in, your finishing position, the league points and the prize amounts;</li>
        <li>the league standings, titles and achievements worked out from those results.</li>
      </UL>
      <p>
        Personal details in the report, such as dates of birth and card or membership numbers, are never shown. Players shown by initials can&apos;t be found by
        searching, and their pages are hidden from search engines.
      </p>
      <p>
        We publish these results because keeping an accurate public record of the league is our legitimate interest, and it&apos;s what players and followers of the
        league expect. Results are kept as long as the league record exists. If you&apos;d rather not be named, ask us and we&apos;ll show you by initials instead.
      </p>

      <H2>Visitors</H2>
      <UL>
        <li>We don&apos;t use analytics, advertising or tracking.</li>
        <li>When a player&apos;s page is viewed we count the view against that player (for &ldquo;most viewed&rdquo; lists). We don&apos;t record who viewed it.</li>
        <li>Our hosting provider keeps short-term technical logs (such as IP addresses) to run and protect the site.</li>
      </UL>

      <H2>Messages you send us</H2>
      <p>
        If you use the contact form we keep your name, email and message so we can reply and act on it. We delete messages 12 months after we&apos;ve dealt with
        them.
      </p>

      <H2>Staff accounts</H2>
      <p>League staff who manage the site sign in with an email address and password. We use these only to give access to the admin area.</p>

      <H2>Who else handles the data</H2>
      <p>
        The site is hosted by Vercel and its database is run by Supabase. They process data on our behalf and may store it outside the UK, under the safeguards the
        law requires. We don&apos;t sell or share personal data with anyone else.
      </p>

      <H2>Cookies</H2>
      <p>
        This site uses no cookies for visitors. Staff who sign in to the admin area get cookies that keep them signed in; these are strictly necessary for that
        and are removed when they sign out. Because we don&apos;t use analytics or advertising cookies, there is no cookie banner. If that ever changes, we&apos;ll
        ask for your consent first.
      </p>

      <H2>Your rights</H2>
      <p>You can ask us to:</p>
      <UL>
        <li>tell you what data we hold about you, and give you a copy;</li>
        <li>correct it if it&apos;s wrong;</li>
        <li>show you by initials only, or remove your name;</li>
        <li>stop or limit how we use it.</li>
      </UL>
      <p>
        Use the <A href="/contact">contact form</A>{" "}and we&apos;ll reply within one month. Corrections to results usually also need the league to correct its
        report, so we&apos;ll pass those on.
      </p>
      <p>
        If you&apos;re unhappy with how we handle your data, you can complain to the Information Commissioner&apos;s Office at{" "}
        <A href="https://ico.org.uk/make-a-complaint/">ico.org.uk</A>{" "}or on 0303 123 1113.
      </p>
    </LegalPage>
  );
}
