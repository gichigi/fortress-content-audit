/** Shared footer: buffers content from bottom of viewport, same on home and dashboard */
export function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="font-serif text-xl font-semibold">Fortress</div>
          <p className="text-sm text-muted-foreground">© 2026 Fortress. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
