import { pageMeta } from "@/lib/site";
import { LEGAL } from "@/lib/legal";
import { A, LegalPage, Operator } from "@/components/LegalPage";
import ContactForm from "./ContactForm";

export const metadata = pageMeta({ title: "Contact", description: "Ask for your name to be removed, report a wrong result, or get in touch.", path: "/contact" });

export default async function ContactPage(props: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await props.searchParams;
  return (
    <LegalPage title="Contact" lede="Ask for your name to be shown by initials or removed, report a wrong result, or get in touch about the site." path="/contact">
      <p>
        Results come from the league&apos;s weekly report, so if a result is wrong we&apos;ll check it and, where needed, ask the league to correct its report. For
        questions about league rules, prizes or play-offs, contact the promoter or ask at any participating casino; the <A href="/about">About</A>{" "}page has the
        league&apos;s terms.
      </p>
      {LEGAL.email && (
        <p>
          You can also email <A href={`mailto:${LEGAL.email}`}>{LEGAL.email}</A>.
        </p>
      )}
      <Operator />
      <div className="!mt-8">
        <ContactForm initialTopic={topic} />
      </div>
    </LegalPage>
  );
}
