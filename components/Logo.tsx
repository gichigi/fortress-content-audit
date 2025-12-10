import Link from "next/link"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  linkToHome?: boolean
}

export default function Logo({ size = "md", linkToHome = true }: LogoProps) {
  const sizeClasses = {
    sm: {
      container: "w-6 h-6",
      text: "text-base",
      gap: "gap-2",
    },
    md: {
      container: "w-8 h-8",
      text: "text-xl",
      gap: "gap-3",
    },
    lg: {
      container: "w-10 h-10",
      text: "text-2xl",
      gap: "gap-3",
    },
  }

  // Simple color block logo - works well at small sizes
  const ColorBlockLogo = () => (
    <div className={`${sizeClasses[size].container} rounded-md overflow-hidden shadow-sm`}>
      <div className="h-full w-full grid grid-cols-2">
        {/* Top-left block - primary color */}
        <div className="bg-primary"></div>
        
        {/* Top-right block - accent color */}
        <div className="bg-blue-500"></div>
        
        {/* Bottom-left block - lighter color */}
        <div className="bg-gray-200 dark:bg-gray-700"></div>
        
        {/* Bottom-right block - darker accent */}
        <div className="bg-indigo-600"></div>
      </div>
    </div>
  )

  const logoContent = (
    <div className={`group flex items-center ${sizeClasses[size].gap}`}>
      <ColorBlockLogo />
      <span className={`${sizeClasses[size].text} font-serif font-semibold tracking-tight text-gray-900 dark:text-gray-100`}>
        Fortress
      </span>
    </div>
  )

  if (linkToHome) {
    return (
      <Link href="/" className="flex items-center min-w-0 max-w-[180px] sm:max-w-none">
        {logoContent}
      </Link>
    )
  }

  return logoContent
} 