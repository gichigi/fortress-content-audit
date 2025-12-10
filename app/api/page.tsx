"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Globe, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import Header from "@/components/Header"

// Helper to get absolute URL
const getAbsoluteUrl = (path: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
  return new URL(path, baseUrl).toString()
}

export default function ApiTestPage() {
  const { toast } = useToast()
  const [extractUrl, setExtractUrl] = useState("")
  const [extractLoading, setExtractLoading] = useState(false)
  const [extractResponse, setExtractResponse] = useState("")
  const [extractError, setExtractError] = useState<string | null>(null)

  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateResponse, setGenerateResponse] = useState("")
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [brandInfo, setBrandInfo] = useState(
    JSON.stringify(
      {
        name: "Test Brand",
        year: "2023",
        description: "A test brand for API testing",
        audience: "developers",
        channels: "website, email",
      },
      null,
      2,
    ),
  )

  const testExtractWebsite = async () => {
    if (!extractUrl) {
      toast({
        title: "URL required",
        description: "Please enter a URL to test the extraction API",
        variant: "destructive",
      })
      return
    }

    setExtractLoading(true)
    setExtractResponse("")
    setExtractError(null)

    try {
      // Format the URL if needed
      let formattedUrl = extractUrl
      if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
        formattedUrl = "https://" + formattedUrl
      }

      const response = await fetch(getAbsoluteUrl("/api/extract-website"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: formattedUrl }),
      })

      const data = await response.json()
      setExtractResponse(JSON.stringify(data, null, 2))

      if (!response.ok || !data.success) {
        setExtractError(data.error || `API returned status ${response.status}`)
        toast({
          title: "API test failed",
          description: data.error || `Status: ${response.status} ${response.statusText}`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "API test successful",
          description: `Status: ${response.status} ${response.statusText}`,
        })
      }
    } catch (error) {
      console.error("Error testing extract API:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setExtractError(errorMessage)
      setExtractResponse(JSON.stringify({ error: "Failed to fetch API", message: errorMessage }, null, 2))

      toast({
        title: "API test failed",
        description: "There was an error connecting to the API",
        variant: "destructive",
      })
    } finally {
      setExtractLoading(false)
    }
  }

  const testGenerateStyleguide = async () => {
    setGenerateLoading(true)
    setGenerateResponse("")
    setGenerateError(null)

    try {
      let parsedBrandInfo
      try {
        parsedBrandInfo = JSON.parse(brandInfo)
        console.log("Parsed brand info:", parsedBrandInfo)
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Invalid JSON format"
        setGenerateError(errorMessage)
        toast({
          title: "Invalid JSON",
          description: "Please enter valid JSON for brand info",
          variant: "destructive",
        })
        setGenerateLoading(false)
        return
      }

      console.log("Sending request to generate-styleguide API with:", parsedBrandInfo)

      const response = await fetch(getAbsoluteUrl("/api/generate-styleguide"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandInfo: parsedBrandInfo,
          plan: "core",
        }),
      })

      console.log("API response status:", response.status)

      const data = await response.json()
      console.log("API response data:", data)

      // Truncate the style guide text if it's too long for display
      if (data.styleGuide && data.styleGuide.length > 1000) {
        data.styleGuide = data.styleGuide.substring(0, 1000) + "... [truncated]"
      }

      setGenerateResponse(JSON.stringify(data, null, 2))

      if (!response.ok || !data.success) {
        setGenerateError(data.error || `API returned status ${response.status}`)
        toast({
          title: "API test failed",
          description: data.error || `Status: ${response.status} ${response.statusText}`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "API test successful",
          description: `Status: ${response.status} ${response.statusText}`,
        })
      }
    } catch (error) {
      console.error("Error testing generate API:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setGenerateError(errorMessage)
      setGenerateResponse(JSON.stringify({ error: "Failed to fetch API", message: errorMessage }, null, 2))

      toast({
        title: "API test failed",
        description: "There was an error connecting to the API",
        variant: "destructive",
      })
    } finally {
      setGenerateLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold mb-6">API Testing</h1>
          <p className="text-muted-foreground mb-8">Use this page to test the API endpoints for Style Guide AI.</p>

          <Tabs defaultValue="extract" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="extract">Extract Website</TabsTrigger>
              <TabsTrigger value="generate">Generate Style Guide</TabsTrigger>
            </TabsList>

            <TabsContent value="extract">
              <Card>
                <CardHeader>
                  <CardTitle>Test Extract Website API</CardTitle>
                  <CardDescription>This endpoint extracts brand information from a website URL.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6">
                    <div className="grid gap-3">
                      <Label htmlFor="website-url">Website URL</Label>
                      <Input
                        id="website-url"
                        type="url"
                        placeholder="https://example.com"
                        value={extractUrl}
                        onChange={(e) => setExtractUrl(e.target.value)}
                      />
                    </div>

                    {extractError && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-red-800">Error</h4>
                          <p className="text-sm text-red-700 mt-1">{extractError}</p>
                        </div>
                      </div>
                    )}

                    {extractResponse && (
                      <div className="grid gap-3">
                        <Label htmlFor="extract-response">Response</Label>
                        <Textarea
                          id="extract-response"
                          readOnly
                          value={extractResponse}
                          rows={12}
                          className="font-mono text-sm"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button onClick={testExtractWebsite} disabled={extractLoading}>
                    {extractLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Test API"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="generate">
              <Card>
                <CardHeader>
                  <CardTitle>Test Generate Style Guide API</CardTitle>
                  <CardDescription>This endpoint generates a style guide based on brand information.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6">
                    <div className="grid gap-3">
                      <Label htmlFor="brand-info">Brand Information (JSON)</Label>
                      <Textarea
                        id="brand-info"
                        value={brandInfo}
                        onChange={(e) => setBrandInfo(e.target.value)}
                        rows={8}
                        className="font-mono text-sm"
                      />
                    </div>

                    {generateError && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-red-800">Error</h4>
                          <p className="text-sm text-red-700 mt-1">{generateError}</p>
                        </div>
                      </div>
                    )}

                    {generateResponse && (
                      <div className="grid gap-3">
                        <Label htmlFor="generate-response">Response</Label>
                        <Textarea
                          id="generate-response"
                          readOnly
                          value={generateResponse}
                          rows={12}
                          className="font-mono text-sm"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button onClick={testGenerateStyleguide} disabled={generateLoading}>
                    {generateLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Test API"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
