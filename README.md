# Style Guide AI

A powerful web application that generates professional style guides for brands using AI. Create, customize, and download comprehensive style guidelines with just a few clicks.

## Features

- **AI-Powered Style Guide Generation**: Create complete brand style guides based on brand details
- **Core and Complete Guides**: Choose between concise core guides or full comprehensive guides
- **Multiple Export Formats**: Download your style guide as PDF, Word-compatible HTML, web-ready HTML, or markdown
- **Brand Voice Traits**: Automatically generate distinctive voice characteristics that match your brand's tone and audience
- **25 Core Writing Rules**: Get detailed writing guidance specific to your brand identity

## Technologies

- Next.js 15.2
- React 19
- TypeScript
- Tailwind CSS
- Radix UI Components
- OpenAI API
- jsPDF for PDF generation
- Markdown processing with react-markdown + remark-gfm

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- OpenAI API key

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/style-guide-ai.git
   cd style-guide-ai
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Set up environment variables
   Create a `.env.local` file with:
   ```
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Start the development server
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) to view the app

## Usage

1. Enter your brand details (name, audience, tone, description)
2. Choose between core or complete style guide
3. View the generated style guide with brand voice traits and writing rules
4. Download in your preferred format (PDF, Word HTML, web HTML, or Markdown)

## License

MIT

## Acknowledgements

- OpenAI for AI capabilities
- Vercel for hosting and deployment
- Various open-source libraries that made this project possible 