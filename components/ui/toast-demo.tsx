"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export function ToastDemo() {
  const { toast } = useToast()

  const handleSuccessToast = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    toast({
      title: "Export successful",
      description: "Your audit has been exported as PDF.",
    })
  }

  const handleErrorToast = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    toast({
      title: "Unable to export",
      description: "Please try again or contact support if the issue persists.",
      variant: "error",
    })
  }

  const handleInfoToast = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated.",
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <Button
          type="button"
          onClick={handleSuccessToast}
        >
          Success Toast
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleErrorToast}
        >
          Error Toast
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleInfoToast}
        >
          Info Toast
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Click the buttons above to see toast notifications in action. They appear at the bottom right and automatically dismiss.
      </p>
    </div>
  )
}

