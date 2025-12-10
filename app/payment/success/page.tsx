"use client"

import React, { Suspense } from "react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import posthog from "posthog-js"
import { ErrorDetails } from "@/lib/api-utils"
import { ErrorMessage } from "@/components/ui/error-message"
import { Progress } from "@/components/ui/progress"
import { InterstitialLoader } from "@/components/ui/interstitial-loader"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase"

// Declare gtag function for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [generationStatus, setGenerationStatus] = useState<'generating' | 'complete' | 'error'>('generating')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [guideType, setGuideType] = useState<string>('core')
  const [apiError, setApiError] = useState<ErrorDetails | null>(null)
  const [isRetrying, setIsRetrying] = useState<boolean>(false)
  const [currentStep, setCurrentStep] = useState<string>('Preparing your brand details')
  const [progress, setProgress] = useState<number>(0)
  const [guidelineId, setGuidelineId] = useState<string | null>(null)
  const [showOpeningEditor, setShowOpeningEditor] = useState(false)

  // Progress steps for complete guide (two API calls)
  const getProgressSteps = (plan: string) => {
    if (plan === 'complete') {
      return [
        { message: 'Preparing your brand details', progress: 10 },
        { message: 'Analyzing your brand voice and personality', progress: 30 },
        { message: 'Defining communication style', progress: 50 },
        { message: 'Creating comprehensive writing rules', progress: 70 },
        { message: 'Generating practical examples', progress: 90 },
        { message: 'Finalizing your style guide', progress: 100 }
      ]
    } else {
      return [
        { message: 'Preparing your brand details', progress: 20 },
        { message: 'Analyzing your brand voice', progress: 50 },
        { message: 'Creating core guidelines', progress: 80 },
        { message: 'Finalizing your style guide', progress: 100 }
      ]
    }
  }

  // Update progress as generation happens
  const updateProgress = (plan: string, stage: 'start' | 'voice' | 'rules' | 'complete') => {
    const steps = getProgressSteps(plan)
    switch (stage) {
      case 'start':
        setCurrentStep(steps[0].message)
        setProgress(steps[0].progress)
        break
      case 'voice':
        if (plan === 'complete') {
          setCurrentStep(steps[2].message)
          setProgress(steps[2].progress)
        } else {
          setCurrentStep(steps[1].message)
          setProgress(steps[1].progress)
        }
        break
      case 'rules':
        if (plan === 'complete') {
          setCurrentStep(steps[4].message)
          setProgress(steps[4].progress)
        } else {
          setCurrentStep(steps[2].message)
          setProgress(steps[2].progress)
        }
        break
      case 'complete':
        setCurrentStep(steps[steps.length - 1].message)
        setProgress(100)
        break
    }
  }

  // Generate style guide function (extracted for retry functionality)
  const generateStyleGuide = async (overrideGuideType?: string) => {
    const effectiveGuideType = overrideGuideType || guideType
    try {
      // Clear any previous errors
      setApiError(null)
      setGenerationStatus('generating')
      updateProgress(effectiveGuideType, 'start')
      
      // Get brand details
      const brandDetails = localStorage.getItem("brandDetails")
      if (!brandDetails) {
        console.error("[Payment Success] No brand details found in localStorage")
        toast({
          title: "Session expired",
          description: "Please fill in your brand details again.",
          variant: "destructive",
        })
        // Redirect to dashboard
        router.push("/dashboard")
        return
      }

      console.log("[Payment Success] Found brand details, generating style guide...")
      
      // Parse and log the brand details
      const parsedBrandDetails = JSON.parse(brandDetails)
      console.log("[Payment Success] Parsed brand details:", parsedBrandDetails)
      console.log("[Payment Success] Sending to API with plan:", guideType)

      // Update progress before API call
      updateProgress(effectiveGuideType, 'voice')

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to generate your style guide.",
          variant: "destructive",
        })
        router.push(`/sign-up?next=${encodeURIComponent('/payment/success')}`)
        return
      }

      // Generate style guide using fetch with auth headers
      const response = await fetch("/api/generate-styleguide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          brandDetails: parsedBrandDetails,
          plan: effectiveGuideType
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || "Failed to generate style guide")
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to generate style guide")
      }

      // Update progress to complete
      updateProgress(effectiveGuideType, 'complete')

      // Save generated style guide to localStorage as fallback
      localStorage.setItem("generatedStyleGuide", data.styleGuide)
      
      // Store guidelineId if available
      if (data.guidelineId) {
        setGuidelineId(data.guidelineId)
        localStorage.setItem("guidelineId", data.guidelineId)
      }
      
      // Update status
      setGenerationStatus('complete')

      // Show success message
      toast({
        title: "Style guide generated!",
        description: "Your guide is ready to view.",
      })

    } catch (error) {
      console.error("Generation error:", error)
      
      // Use enhanced error handling
      if (error && typeof error === 'object' && 'message' in error && 'type' in error) {
        // This is already an ErrorDetails object from callAPI
        setApiError(error as ErrorDetails)
      } else {
        // Fallback for unexpected error format
        setApiError({
          message: "Something unexpected happened. Please try again or contact support if the issue persists.",
          type: "UNKNOWN_ERROR",
          canRetry: true,
          supportEmailLink: `mailto:support@aistyleguide.com?subject=${encodeURIComponent("Style Guide Generation Issue")}&body=${encodeURIComponent(`Hi Fortress Support Team,

I'm having trouble generating my style guide. Here are the details:

Error: UNKNOWN_ERROR
Time: ${new Date().toLocaleString()}

Please help me resolve this issue.

Thanks!`)}`
        })
      }
      
      setGenerationStatus('error')
      
      // Show basic toast for immediate feedback
      toast({
        title: "Generation failed",
        description: "Please see the detailed error message below.",
        variant: "destructive",
      })
    }
  }

  // Retry function for manual retries
  const handleRetry = async () => {
    setIsRetrying(true)
    setApiError(null)
    
    try {
      await generateStyleGuide()
    } catch (error) {
      // Error is already handled in generateStyleGuide
    } finally {
      setIsRetrying(false)
    }
  }

  useEffect(() => {
    const sessionIdParam = searchParams.get("session_id")
    const guideTypeParam = searchParams.get("guide_type") || searchParams.get("plan") || "core"
    
    setSessionId(sessionIdParam)
    setGuideType(guideTypeParam)
    
    // analytics: upgrade succeeded
    try {
      posthog.capture('upgrade_succeeded', {
        guideType: guideTypeParam,
        has_session_id: !!sessionIdParam,
      })
    } catch {}
    
    // Fire Google Ads conversion event (required even with page load conversion)
    if (typeof window !== 'undefined' && window.gtag) {
      console.log('🎯 Firing Google Ads conversion event...')
      
      // Event snippet as required by Google Ads documentation
      window.gtag('event', 'conversion', {
        'send_to': 'AW-943197631'  // Your conversion will be matched automatically
      })
    }
    
    // Temporarily commented out for testing conversion tracking
    // if (!sessionIdParam) {
    //   toast({
    //     title: "Invalid session",
    //     description: "Could not verify payment status. Please try again.",
    //     variant: "destructive",
    //   })
    //   router.push("/preview")
    //   return
    // }

    // Store payment status and guide type
    localStorage.setItem("styleGuidePaymentStatus", "completed")
    localStorage.setItem("styleGuidePlan", guideTypeParam)

    // Start generation process
    generateStyleGuide(guideTypeParam)
  }, [router, searchParams, toast])

  return (
    <>
      <InterstitialLoader
        open={showOpeningEditor}
        title="Opening editor..."
        description="Taking you to your brand voice guidelines."
      />
      <div className="flex min-h-screen flex-col items-center justify-center bg-blue-50">
      <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-8 text-center max-w-md mx-4">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 relative shadow-lg ${
          generationStatus === 'error' 
            ? 'bg-gradient-to-br from-red-500 to-red-600' 
            : 'bg-gradient-to-br from-blue-500 to-blue-600'
        }`}>
          {generationStatus === 'generating' && (
            <>
              {/* Multiple pulsing rings for depth */}
              <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
              <div className="absolute inset-2 bg-blue-300 rounded-full animate-ping opacity-30" style={{ animationDelay: '150ms' }}></div>
              
              {/* Solid white spinning icon */}
              <Loader2 className="h-10 w-10 animate-spin text-white relative z-10" />
            </>
          )}
          {generationStatus === 'complete' && (
            <svg className="w-10 h-10 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {generationStatus === 'error' && (
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        
        <h1 className="text-xl font-semibold text-gray-900 mb-3">
          {generationStatus === 'generating' && "Payment Successful"}
          {generationStatus === 'complete' && "Your Style Guide is Ready"}
          {generationStatus === 'error' && "Generation Failed"}
        </h1>
        
        <p className="text-gray-600 text-sm mb-4">
          {generationStatus === 'generating' && "We're generating your personalized style guide now."}
          {generationStatus === 'complete' && "Your guide has been generated successfully"}
          {generationStatus === 'error' && "We couldn't make your guide. See details below."}
        </p>
        
        {generationStatus === 'generating' && (
          <div className="space-y-4">
            {/* Additional info based on guide type */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="text-blue-800 text-sm">
                  {guideType === 'complete' 
                    ? <>This might take 2-3 minutes.<br />Please don't leave this page.</>
                    : <>This might take 1-2 minutes.<br />Please don't leave this page.</>}
                </p>
            </div>
          </div>
        )}

        {generationStatus === 'complete' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">Generation Complete</p>
              <p className="text-green-700 text-sm">Your style guide is ready to view and download.</p>
            </div>
            
            <Button 
              onClick={() => {
                // Redirect to dashboard
                router.push("/dashboard")
              }}
              className="w-full"
              size="lg"
            >
              View My Style Guide
            </Button>
          </div>
        )}

        {generationStatus === 'error' && apiError && (
          <div className="space-y-6">
            <Alert variant="destructive">
              <AlertTitle>Generation failed</AlertTitle>
              <AlertDescription>
                Please retry below. Your payment is safe and won’t be charged again.
              </AlertDescription>
            </Alert>
            {/* Reassuring message */}
            <div className="space-y-2">
              <p className="text-base text-gray-700">
                Something went wrong during generation, but <strong>your payment was successful</strong>.
              </p>
              <p className="text-sm text-gray-600">
                We'll get this sorted for you right away.
              </p>
            </div>

            {/* Enhanced ErrorMessage component with smart retry */}
            <ErrorMessage
              error={apiError}
              onRetry={handleRetry}
              isRetrying={isRetrying}
              showRetryButton={true}
            />
              
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Your payment is secure:</strong> You won't be charged again for retrying. 
                We'll keep trying until your style guide is ready.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuccessContent />
    </Suspense>
  )
}