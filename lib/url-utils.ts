import Logger from "./logger"

export function getAbsoluteUrl(path: string, requestUrl?: string): string {
  Logger.debug("Getting absolute URL", { path, requestUrl })

  try {
    // If we're in the browser
    if (typeof window !== "undefined") {
      const url = new URL(path, window.location.origin)
      Logger.debug("Created browser-side absolute URL", { url: url.toString() })
      return url.toString()
    }

    // If we're on the server and have a request URL
    if (requestUrl) {
      const url = new URL(path, new URL(requestUrl).origin)
      Logger.debug("Created server-side absolute URL from request", { url: url.toString() })
      return url.toString()
    }

    // If we're on the server but don't have a request URL, use environment variable
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    if (baseUrl) {
      const url = new URL(path, baseUrl)
      Logger.debug("Created server-side absolute URL from env", { url: url.toString() })
      return url.toString()
    }

    // Fallback to relative URL with warning
    Logger.warn("Could not create absolute URL, falling back to relative path", { path })
    return path
  } catch (error) {
    Logger.error("Error creating absolute URL", error instanceof Error ? error : new Error("Unknown error"), {
      path,
      requestUrl,
    })
    return path
  }
} 