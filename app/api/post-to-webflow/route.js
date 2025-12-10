// app/api/post-to-webflow/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const requestBody = await req.json();
    console.log("Received request body:", requestBody);

    // Try multiple field name variations that Zapier might send
    const title = requestBody.title || requestBody.name || requestBody.Title;
    const slug = requestBody.slug || requestBody.Slug;
    const body = requestBody.body || requestBody.content || requestBody.Body || requestBody.Content;
    const contentSummary = requestBody.contentSummary || requestBody.summary || requestBody.Summary || "Default summary";

    // Validate required fields
    if (!title || !slug || !body) {
      return NextResponse.json({ 
        error: `Missing required fields. Received: ${JSON.stringify(requestBody)}. Need: title, slug, body` 
      }, { status: 400 });
    }

    const WEBFLOW_SITE_ID = process.env.WEBFLOW_SITE_ID;
    const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
    const WEBFLOW_TOKEN = process.env.WEBFLOW_TOKEN;

    const endpoint = `https://api.webflow.com/v2/sites/${WEBFLOW_SITE_ID}/collections/${WEBFLOW_COLLECTION_ID}/items`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WEBFLOW_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        isArchived: false,
        isDraft: false,
        fieldData: {
          name: title,
          slug: slug,
          location: "Lisbon", // Always use Lisbon as location
          content: body,
          "content-summary": contentSummary,
          category: "68f8ff5305fca0c8ae56ed38", // Always use Business category
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Webflow API error:", data);
      console.error("Request payload was:", {
        name: title,
        slug: slug,
        location: "Lisbon",
        content: body,
        "content-summary": contentSummary,
        category: "68f8ff5305fca0c8ae56ed38"
      });
      return NextResponse.json({ error: data }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Error in /api/post-to-webflow:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
