import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"
import { Progress } from "@/components/ui/progress"
import { StickyBottomBar } from "@/components/ui/sticky-bottom-bar"
import { InterstitialLoaderDemo } from "@/components/ui/interstitial-loader-demo"
import fs from 'fs'
import path from 'path'

export default function DesignSystemPage() {
  // Read the markdown content at build time
  let brandVoiceContent = ""
  try {
    const filePath = path.join(process.cwd(), 'FORTRESS_BRAND_VOICE.md')
    brandVoiceContent = fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    console.error('Error reading FORTRESS_BRAND_VOICE.md:', error)
    brandVoiceContent = "# Brand Voice Guidelines\n\nContent currently unavailable."
  }
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="text-2xl font-serif font-semibold tracking-tight">Fortress</div>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to Home
          </a>
        </nav>
      </header>

      <div className="container mx-auto px-6 py-16 max-w-5xl">
        {/* Title */}
        <div className="mb-24">
          <h1 className="font-serif text-6xl md:text-7xl font-light tracking-tight text-balance mb-6">Design System</h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
            The visual language and principles that define Fortress. Editorial, intentional, defensible.
          </p>
        </div>

        {/* Principles */}
        <section className="mb-32">
          <h2 className="font-serif text-4xl font-semibold mb-8 border-b border-border pb-4">Principles</h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-3">Clarity over cleverness</h3>
              <p className="text-muted-foreground leading-relaxed">
                Direct communication builds trust. Avoid jargon, wordplay, or unnecessary embellishment.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-3">Generous spacing</h3>
              <p className="text-muted-foreground leading-relaxed">
                Whitespace creates breathing room. Let elements stand on their own with confidence.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-3">Typographic hierarchy</h3>
              <p className="text-muted-foreground leading-relaxed">
                Scale and weight guide the eye. Serif for statements, sans-serif for reading.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-3">Straight edges</h3>
              <p className="text-muted-foreground leading-relaxed">
                Architectural precision over soft curves. Zero border radius maintains formality and strength.
              </p>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-32">
          <h2 className="font-serif text-4xl font-semibold mb-8 border-b border-border pb-4">Typography</h2>

          <div className="space-y-12">
            <div>
              <p className="text-sm text-muted-foreground mb-8 uppercase tracking-wider">Serif — Cormorant Garamond</p>
              <div className="space-y-8">
                <div>
                  <p className="font-semibold text-lg mb-3 text-foreground">Headlines</p>
                  <p className="font-serif text-6xl font-light tracking-tight mb-2">Headlines</p>
                  <p className="text-sm text-muted-foreground">Light, 96px, -0.02em tracking</p>
                </div>
                <div>
                  <p className="font-semibold text-lg mb-3 text-foreground">Subheadings</p>
                  <p className="font-serif text-4xl font-semibold mb-2">Subheadings</p>
                  <p className="text-sm text-muted-foreground">Semibold, 36px</p>
                </div>
                <div>
                  <p className="font-semibold text-lg mb-3 text-foreground">Section Titles</p>
                  <p className="font-serif text-2xl font-semibold mb-2">Section Titles</p>
                  <p className="text-sm text-muted-foreground">Semibold, 24px</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-12">
              <p className="text-sm text-muted-foreground mb-8 uppercase tracking-wider">Sans-Serif — Geist</p>
              <div className="space-y-8">
                <div>
                  <p className="font-semibold text-lg mb-3 text-foreground">Body</p>
                  <p className="text-xl leading-relaxed mb-2">
                    Body text for reading and comprehension. Clear, neutral, functional. Line height of 1.6 ensures
                    readability across all screen sizes.
                  </p>
                  <p className="text-sm text-muted-foreground">Regular, 20px, 1.6 line-height</p>
                </div>
                <div>
                  <p className="font-semibold text-lg mb-3 text-foreground">Secondary Body</p>
                  <p className="text-base leading-relaxed mb-2">
                    Secondary body text for supporting information and descriptions.
                  </p>
                  <p className="text-sm text-muted-foreground">Regular, 16px, 1.6 line-height</p>
                </div>
                <div>
                  <p className="font-semibold text-lg mb-3 text-foreground">Small Text</p>
                  <p className="text-sm mb-2">Small text for metadata, captions, and labels.</p>
                  <p className="text-sm text-muted-foreground">Regular, 14px</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Color */}
        <section className="mb-32">
          <h2 className="font-serif text-4xl font-semibold mb-8 border-b border-border pb-4">Color</h2>

          <div className="space-y-12">
            <div>
              <p className="text-sm text-muted-foreground mb-6 uppercase tracking-wider">Neutrals</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="h-24 bg-background border-2 border-border mb-3"></div>
                  <p className="text-sm font-medium mb-1">Background</p>
                  <p className="text-xs text-muted-foreground font-mono">oklch(0.98 0.002 85)</p>
                </div>
                <div>
                  <div className="h-24 bg-foreground border-2 border-border mb-3"></div>
                  <p className="text-sm font-medium mb-1">Foreground</p>
                  <p className="text-xs text-muted-foreground font-mono">oklch(0.15 0.002 85)</p>
                </div>
                <div>
                  <div className="h-24 bg-muted border-2 border-border mb-3"></div>
                  <p className="text-sm font-medium mb-1">Muted</p>
                  <p className="text-xs text-muted-foreground font-mono">oklch(0.94 0.002 85)</p>
                </div>
                <div>
                  <div className="h-24 bg-muted-foreground border-2 border-border mb-3"></div>
                  <p className="text-sm font-medium mb-1">Muted Foreground</p>
                  <p className="text-xs text-muted-foreground font-mono">oklch(0.45 0.002 85)</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-12">
              <p className="text-sm text-muted-foreground mb-6 uppercase tracking-wider">Borders & Accents</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <div className="h-24 bg-border border-2 border-border mb-3"></div>
                  <p className="text-sm font-medium mb-1">Border</p>
                  <p className="text-xs text-muted-foreground font-mono">oklch(0.88 0.002 85)</p>
                </div>
                <div>
                  <div className="h-24 bg-primary border-2 border-border mb-3"></div>
                  <p className="text-sm font-medium mb-1">Primary</p>
                  <p className="text-xs text-muted-foreground font-mono">oklch(0.17 0.002 85)</p>
                </div>
                <div>
                  <div className="h-24 bg-secondary border-2 border-border mb-3"></div>
                  <p className="text-sm font-medium mb-1">Secondary</p>
                  <p className="text-xs text-muted-foreground font-mono">oklch(0.94 0.002 85)</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-12">
              <p className="text-sm text-muted-foreground mb-4">
                The palette is intentionally neutral. Almost no saturation. This allows content and typography to carry
                the visual weight, not color.
              </p>
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section className="mb-32">
          <h2 className="font-serif text-4xl font-semibold mb-8 border-b border-border pb-4">Spacing</h2>

          <div className="space-y-8">
            <div className="border border-border p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-foreground"></div>
                  <p className="text-sm text-muted-foreground">16px (1rem) — Component padding</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-foreground"></div>
                  <p className="text-sm text-muted-foreground">24px (1.5rem) — Section spacing</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 bg-foreground"></div>
                  <p className="text-sm text-muted-foreground">32px (2rem) — Large section spacing</p>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Use multiples of 8px for vertical rhythm. Generous spacing prevents visual clutter and allows each element
              to command attention individually.
            </p>
          </div>
        </section>

        {/* Components */}
        <section className="mb-32">
          <h2 className="font-serif text-4xl font-semibold mb-8 border-b border-border pb-4">Components</h2>
          <div className="space-y-12">
            {/* Buttons */}
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-6">Button</h3>
              <div className="flex gap-4 flex-wrap">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>
            {/* Input */}
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-6">Input</h3>
              <div className="flex flex-col gap-2 w-64">
                <Label htmlFor="demo-input">Label</Label>
                <Input id="demo-input" placeholder="Placeholder" />
              </div>
            </div>
            {/* Badge */}
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-6">Badge</h3>
              <div className="flex gap-4 flex-wrap items-center">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Use badges for metadata, time estimates, and status indicators. Outline variant works well for subtle information.
              </p>
            </div>
            {/* Alert */}
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-6">Alert</h3>
              <Alert>
                <AlertTitle>Heads up!</AlertTitle>
                <AlertDescription>This is a basic alert using brand atoms.</AlertDescription>
              </Alert>
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>This is a destructive variant.</AlertDescription>
              </Alert>
            </div>
            {/* Card */}
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-6">Card</h3>
              <Card className="w-72">
                <CardHeader>
                  <CardTitle>Card Title</CardTitle>
                  <CardDescription>Card description text.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Input placeholder="In card input" />
                </CardContent>
                <CardFooter>
                  <Button size="sm">Action</Button>
                </CardFooter>
              </Card>
            </div>
            {/* Progress */}
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-6">Progress</h3>
              <div className="space-y-4 w-64">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Default (h-2)</p>
                  <Progress value={60} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Thin variant (h-1) - for step indicators</p>
                  <Progress value={40} size="thin" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Use the thin variant for step progress indicators in multi-step flows. Default variant works well for general progress tracking.
              </p>
            </div>
            {/* Tabs */}
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-6">Tabs</h3>
              <Tabs defaultValue="first" className="w-72">
                <TabsList>
                  <TabsTrigger value="first">First</TabsTrigger>
                  <TabsTrigger value="second">Second</TabsTrigger>
                </TabsList>
                <TabsContent value="first">First tab content</TabsContent>
                <TabsContent value="second">Second tab content</TabsContent>
              </Tabs>
            </div>
            {/* Sticky Bottom Bar */}
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-6">Sticky Bottom Bar</h3>
              <div className="relative border border-border p-8 rounded-lg bg-muted/20 min-h-[200px]">
                <p className="text-sm text-muted-foreground mb-4">
                  Fixed position bar at the bottom of the viewport. Commonly used for primary actions in forms and multi-step flows.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Backdrop blur with semi-transparent background</p>
                  <p>• Border-top separator</p>
                  <p>• Configurable max-width and alignment</p>
                  <p>• Responsive container padding</p>
                </div>
                <div className="mt-6 p-4 bg-background border border-border rounded">
                  <p className="text-xs text-muted-foreground font-mono">
                    {'<StickyBottomBar maxWidth="4xl" align="end">'}
                    <br />
                    {'  <Button>Continue</Button>'}
                    <br />
                    {'</StickyBottomBar>'}
                  </p>
                </div>
              </div>
            </div>
            {/* Interstitial Loader */}
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-6">Interstitial Loader</h3>
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Full-screen loading overlay with centered content. Used for blocking loading states during critical operations, particularly between major flow steps (e.g., between clarifying questions and A/B comparisons).
                </p>
                
                {/* Format & Structure */}
                <div>
                  <h4 className="font-serif text-xl font-semibold mb-4">Format & Structure</h4>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>• Fixed overlay covering entire viewport</p>
                    <p>• Centered content container with max-width constraint</p>
                    <p>• Spinner, title, and optional description stacked vertically</p>
                    <p>• Fade-in animation on mount</p>
                  </div>
                </div>

                {/* Animation */}
                <div>
                  <h4 className="font-serif text-xl font-semibold mb-4">Animation</h4>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>• <code className="text-xs bg-muted px-1.5 py-0.5 rounded">animate-in fade-in duration-300</code> — Smooth fade-in transition</p>
                    <p>• Spinner uses <code className="text-xs bg-muted px-1.5 py-0.5 rounded">animate-spin</code> for continuous rotation</p>
                  </div>
                </div>

                {/* Styling Specifications */}
                <div>
                  <h4 className="font-serif text-xl font-semibold mb-4">Styling Specifications</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium mb-1">Overlay Container</p>
                      <p className="text-muted-foreground font-mono text-xs bg-muted px-2 py-1 rounded">
                        fixed inset-0 bg-background z-50 flex items-center justify-center
                      </p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Content Wrapper</p>
                      <p className="text-muted-foreground font-mono text-xs bg-muted px-2 py-1 rounded">
                        text-center max-w-md px-6
                      </p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Spinner</p>
                      <p className="text-muted-foreground font-mono text-xs bg-muted px-2 py-1 rounded">
                        h-12 w-12 animate-spin text-primary mx-auto mb-6
                      </p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Title</p>
                      <p className="text-muted-foreground font-mono text-xs bg-muted px-2 py-1 rounded">
                        font-serif text-3xl font-light tracking-tight mb-4
                      </p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Description</p>
                      <p className="text-muted-foreground font-mono text-xs bg-muted px-2 py-1 rounded">
                        text-muted-foreground
                      </p>
                    </div>
                  </div>
                </div>

                {/* Interactive Demo */}
                <div>
                  <h4 className="font-serif text-xl font-semibold mb-4">Interactive Demo</h4>
                  <InterstitialLoaderDemo />
                </div>

                {/* Use Cases */}
                <div>
                  <h4 className="font-serif text-xl font-semibold mb-4">Use Cases</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Transition between clarifying questions and A/B comparisons</p>
                    <p>• Loading states during critical API operations</p>
                    <p>• Blocking user interaction during data processing</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Toast (Toaster) - just show mount, demo needs to be user-action driven */}
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-6">Toast (Toaster)</h3>
              <p className="text-sm text-muted-foreground mb-2">Toasts show at bottom right on action in live app.</p>
              <Toaster />
            </div>
          </div>
        </section>

        {/* Brand Voice Guidelines (Markdown full doc) */}
        <section className="mb-32">
          <h2 className="font-serif text-4xl font-semibold mb-8 border-b border-border pb-4">Brand Voice (Full Guidelines)</h2>
          {/* Render the FORTRESS_BRAND_VOICE.md as markdown here */}
          <div className="prose max-w-none">
            <MarkdownRenderer content={brandVoiceContent} />
          </div>
        </section>
        {/* Footer */}
        <footer className="border-t border-border pt-12">
          <p className="text-sm text-muted-foreground">
            This design system defines how Fortress communicates visually and verbally. Consistency builds
            defensibility.
          </p>
        </footer>
      </div>
    </div>
  )
}
