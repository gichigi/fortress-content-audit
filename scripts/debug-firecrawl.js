import { crawlSite } from "../lib/firecrawl.js"

async function main() {
  const domain = process.argv[2] || "https://nextjs.org"
  const limit = Number(process.argv[3] || 3)
  const result = await crawlSite(domain, limit)
  console.log("Success:", result.success, "Error:", result.error)
  result.pages.forEach((p, i) => {
    console.log("\n=== Page", i + 1, "===")
    console.log("URL:", p.url)
    console.log("Length:", (p.markdown || p.text || "").length)
    console.log(p.markdown || p.text || "")
  })
}

main().catch(console.error)

