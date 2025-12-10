import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BookOpen, ListChecks, MessageCircle, CheckSquare, Info, ArrowLeft } from "lucide-react"

const accentBar = "absolute left-0 top-0 h-full w-1.5 bg-blue-600 rounded-l-2xl";
const iconClass = "text-blue-600 mr-2 inline-block";

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center py-16 px-2">
      <section className="relative w-full max-w-3xl flex flex-col gap-8">
        {/* Back button */}
        <div className="mb-4">
          <Button
            asChild
            variant="ghost"
            className="text-gray-600 hover:text-gray-900"
          >
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
        {/* Demo badge */}
        <div className="absolute top-6 right-6 z-10">
          <span className="bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-xs font-bold tracking-wide shadow-sm">Demo</span>
        </div>
        {/* Title */}
        <header className="flex flex-col items-center gap-2 mb-2">
          <span className="text-gray-400 text-sm font-mono tracking-wide">May 28, 2024</span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 text-center leading-tight">Nike Style Guide</h1>
          <p className="text-lg text-gray-600 font-medium text-center mt-2">An essential guide to keep every message clear and consistent.</p>
        </header>
        {/* Section Cards Start */}
        <div className="relative bg-white rounded-2xl shadow-md border border-gray-100 px-8 py-8 mb-2">
          <div className={accentBar} aria-hidden="true"></div>
          <div className="flex items-center mb-2">
            <BookOpen size={22} className={iconClass} />
            <h2 className="text-xl font-bold text-gray-900">How to Use This Document</h2>
          </div>
          <p className="text-gray-700 text-base leading-relaxed">This document outlines the rules for brand voice, spelling, grammar, and formatting across all content channels. Anyone writing and publishing content for Nike should follow these guidelines.</p>
        </div>
        <div className="relative bg-white rounded-2xl shadow-md border border-gray-100 px-8 py-8 mb-2">
          <div className={accentBar} aria-hidden="true"></div>
          <div className="flex items-center mb-4">
            <ListChecks size={22} className={iconClass} />
            <h2 className="text-xl font-bold text-gray-900">General Guidelines</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Short content</h3>
              <p className="text-xs text-gray-400 mb-2">social, ads, web snippets</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                <li><b>Write like a human:</b> use everyday language and avoid jargon.</li>
                <li><b>Be an authority:</b> write with a positive outlook to inspire readers.</li>
                <li><b>Be brief:</b> use short sentences, short paragraphs and use familiar words.</li>
              </ul>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Long content</h3>
              <p className="text-xs text-gray-400 mb-2">blogs, newsletters, articles</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                <li><b>Use bullet lists:</b> turn three or more points into a list to break up text.</li>
                <li><b>Humanise the story:</b> start with why it matters, then show the solution.</li>
                <li><b>Use line breaks:</b> break up long text for better readability.</li>
                <li><b>Add subheadings:</b> draft content first, then add subheadings that engage.</li>
                <li><b>Use numbers:</b> lead with key figures that jump out at the reader.</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="relative bg-white rounded-2xl shadow-md border border-gray-100 px-8 py-8 mb-2">
          <div className={accentBar} aria-hidden="true"></div>
          <div className="flex items-center mb-2">
            <MessageCircle size={22} className={iconClass} />
            <h2 className="text-xl font-bold text-gray-900">Brand Voice</h2>
          </div>
          <p className="text-gray-700 mb-4">Nike's voice is confident, inspiring, and energetic.</p>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">1. Confidence</h3>
              <p className="text-gray-600">Nike speaks with authority and self-assurance, motivating athletes to push their limits.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">2. Inspiration</h3>
              <p className="text-gray-600">Nike's language uplifts and encourages, always aiming to spark action.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">3. Energy</h3>
              <p className="text-gray-600">Nike's tone is dynamic and lively, reflecting the spirit of sport and movement.</p>
            </div>
          </div>
        </div>
        <div className="relative bg-white rounded-2xl shadow-md border border-gray-100 px-8 py-8 mb-2">
          <div className={accentBar} aria-hidden="true"></div>
          <div className="flex items-center mb-4">
            <CheckSquare size={22} className={iconClass} />
            <h2 className="text-xl font-bold text-gray-900">25 Core Rules</h2>
          </div>
          <ol className="space-y-6 text-gray-700">
            <li>
              <b>Abbreviations</b><br />
              Use recognized abbreviations.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "USA", "NBA"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "U.S.A.", "N.B.A."
            </li>
            <li>
              <b>Acronyms</b><br />
              Spell out acronyms on first use, then use acronym only for the rest of document.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "National Collegiate Athletic Association (NCAA)"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "NCAA"
            </li>
            <li>
              <b>Apostrophes</b><br />
              Use apostrophes where possession or letters are gone.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "the athlete's gear"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "the athletes gear"
            </li>
            <li>
              <b>Capitalization</b><br />
              Capitalize major announcements, brand names, special event programs.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "Nike", "Air Max", "Just Do It"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "the nike event"
            </li>
            <li>
              <b>Compound Adjectives</b><br />
              Use hyphens to join words together for clarity.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "high-performance shirt"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "high performance shirt"
            </li>
            <li>
              <b>Contractions</b><br />
              Use contractions in casual writing, not in formal content.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "Nike's new summer shoes"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "Nike is new summer shoes"
            </li>
            <li>
              <b>Dates & Time</b><br />
              Use Month Date, Year format. Write time as 3:00pm, not 15:00.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "May 28, 2024, 3:00pm"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "28/05/2024, 15:00"
            </li>
            <li>
              <b>Dashes</b><br />
              Use em dashes (—) for emphasis or to indicate interruption.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "The event starts at 3:00pm — Go!"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "The event starts at 3:00pm - Go!"
            </li>
            <li>
              <b>Emoji</b><br />
              Use sparingly and only in social posts or emails if it matches communication.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "Good luck! 🏆"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "Every line has an emoji!"
            </li>
            <li>
              <b>Hyphens</b><br />
              Use hyphens for words that would be awkward without.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "well-known athlete"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "well known athlete"
            </li>
            <li>
              <b>1000 These</b><br />
              Capitalize These when used as product line but not when used generally.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "These Shoes", "These Shorts"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "these shoes", "these shorts"
            </li>
            <li>
              <b>Measurements</b><br />
              Use numbers and abbreviations (cm, kg) for all units of measure.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "The shoe is 28cm long"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "The shoe is twenty-eight centimeters long"
            </li>
            <li>
              <b>Money</b><br />
              Use the correct symbol and no extra space between them.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "$50"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "$ 50"
            </li>
            <li>
              <b>Numbers</b><br />
              Use numerals for anything over ten, write numbers for 1-9.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "Nike has 12 stores"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "Nike has twelve stores"
            </li>
            <li>
              <b>Pronouns</b><br />
              Use inclusive pronouns and respect personal identity and inclusion.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "Nike's athletes choose their gear"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "Nike's athletes choose his gear"
            </li>
            <li>
              <b>Proper Nouns</b><br />
              Capitalize all brand names and clearly distinguish them from common nouns.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "Nike", "Air Max"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "nike", "air max"
            </li>
            <li>
              <b>Punctuation</b><br />
              Use specific and direct punctuation to maintain short and clean descriptions.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "The race is over. You won!"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "The race is over, you won."
            </li>
            <li>
              <b>Quotation Marks</b><br />
              Use double quotes for direct quotes and single quotes for quotes within quotes.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "The coach said, 'Practice makes perfect.'"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: 'The coach said, "Practice makes perfect."'
            </li>
            <li>
              <b>Serial Commas</b><br />
              Use the Oxford comma in lists of three or more items to avoid ambiguity.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "Shoes, shorts, and water bottle"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "Shoes, shorts and water bottle"
            </li>
            <li>
              <b>Slang & Jargon</b><br />
              Use popular terms if widely understood, otherwise avoid for clarity.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "The athlete crushed it!"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "The athlete pwned it!"
            </li>
            <li>
              <b>Special Characters</b><br />
              Avoid using special characters in regular readable text.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "Nike's mission: inspire athletes"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "Nike's mission: inspire athletes @#!$%"
            </li>
            <li>
              <b>Titles & Headings</b><br />
              Capitalize the first word and all major words in headings.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "The Ultimate Guide to Running Shoes"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "The ultimate guide to running shoes"
            </li>
            <li>
              <b>Trademark</b><br />
              Use the trademark or registered symbol for names in commercial brand things.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "Nike®"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "Nike"
            </li>
            <li>
              <b>1st Person vs 3rd Person</b><br />
              Use first person in casual social, third person in official communication and written articles.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "We believe in every athlete"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "Nike believes in every athlete"
            </li>
            <li>
              <b>Addresses</b><br />
              Use correct address format for all locations.<br />
              <span className="inline-block text-green-600 font-bold">✓</span> e.g. "Nike HQ, One Bowerman Drive, Beaverton, OR 97005"<br />
              <span className="inline-block text-red-500 font-bold">✗</span> Wrong: "Nike HQ, 1 Bowerman Dr, Beaverton, OR"
            </li>
          </ol>
        </div>
        <div className="relative bg-white rounded-2xl shadow-md border border-gray-100 px-8 py-8 flex flex-col items-center gap-6 mt-2">
          <div className={accentBar} aria-hidden="true"></div>
          <div className="flex items-center mb-4 w-full justify-center">
            <Info size={22} className={iconClass} />
            <span className="text-xl font-bold text-gray-900">Contact</span>
          </div>
          <div className="w-full bg-gray-50 border border-gray-200 rounded-lg py-4 px-6 text-center text-gray-500 text-base font-medium">
            Questions? Contact the Nike content team.
          </div>
          <div className="w-full bg-blue-50 border border-blue-200 rounded-lg py-2 px-4 text-center text-blue-700 text-sm font-semibold">
            Export and download options are disabled in demo mode.
          </div>
        </div>
        {/* Section Cards End */}
      </section>
      {/* Sticky CTA Button - always visible at bottom */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none">
        <div className="w-full max-w-3xl px-4 pb-4 pointer-events-auto">
          <Button asChild size="lg" className="w-full max-w-xs text-lg font-bold shadow-md transition-all duration-200 bg-blue-600 hover:bg-blue-700 hover:scale-105 focus:bg-blue-700 focus:scale-105 text-white">
            <Link href="/">Generate Your Own Style Guide</Link>
          </Button>
        </div>
      </div>
      <style>{`
        @media (min-width: 768px) {
          .sticky-cta-demo {
            left: 50%;
            transform: translateX(-50%);
            max-width: 420px;
          }
        }
      `}</style>
    </main>
  )
} 