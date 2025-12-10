import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

// Core processing logic shared between GET and POST
async function processAbandonedEmails() {
  console.log('🔄 Processing abandoned email captures...');
  
  // Get all email captures where payment was not completed after 2 hours
  const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString();
  
  const { data: abandonedCaptures, error } = await supabaseAdmin
    .from('email_captures')
    .select('*')
    .eq('payment_completed', false)
    .eq('abandoned_email_sent', false)
    .lt('captured_at', twoHoursAgo);
  
  if (error) {
    console.error('Error fetching abandoned email captures:', error);
    throw new Error('Database error');
  }
  
  if (!abandonedCaptures || abandonedCaptures.length === 0) {
    console.log('No abandoned email captures found');
    return { 
      message: 'No abandoned emails to process',
      processed: 0 
    };
  }
  
  console.log(`Found ${abandonedCaptures.length} abandoned email captures to process`);
  
  // Import email service
  const { emailService } = await import('@/lib/email-service');
  
  let processedCount = 0;
  let errorCount = 0;
  
  // Process each abandoned email capture
  for (const capture of abandonedCaptures) {
    try {
      console.log(`Processing abandoned email: ${capture.email.substring(0, 5)}***`);
      
      // Use consistent discount code
      const discountCode = 'COMEBACK20';
      
      // Send abandoned cart email
      const emailResult = await emailService.sendAbandonedCartEmail({
        customerEmail: capture.email,
        sessionId: capture.session_token,
        recoveryUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://aistyleguide.com'}/brand-details?fromExtraction=true`,
        discountCode
      });
      
      if (emailResult.success) {
        // Mark as abandoned email sent
        const { error: updateError } = await supabaseAdmin
          .from('email_captures')
          .update({ abandoned_email_sent: true })
          .eq('id', capture.id);
          
        if (updateError) {
          console.error(`Error updating abandoned email status for ${capture.email}:`, updateError);
          errorCount++;
        } else {
          console.log(`✅ Abandoned cart email sent to ${capture.email.substring(0, 5)}***`);
          processedCount++;
        }
      } else {
        console.error(`❌ Failed to send abandoned cart email to ${capture.email}:`, emailResult.error);
        errorCount++;
      }
      
    } catch (error) {
      console.error(`Error processing abandoned email for ${capture.email}:`, error);
      errorCount++;
    }
  }
  
  console.log(`Abandoned email processing complete. Processed: ${processedCount}, Errors: ${errorCount}`);
  
  return {
    message: 'Abandoned email processing complete',
    processed: processedCount,
    errors: errorCount,
    total: abandonedCaptures.length
  };
}

// GET handler for Vercel cron jobs (they make GET requests by default)
export async function GET() {
  try {
    const result = await processAbandonedEmails();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in abandoned email processing (GET):', error);
    return NextResponse.json(
      { error: 'Failed to process abandoned emails' },
      { status: 500 }
    );
  }
}

// POST handler for manual testing
export async function POST(request: Request) {
  try {
    const result = await processAbandonedEmails();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in abandoned email processing (POST):', error);
    return NextResponse.json(
      { error: 'Failed to process abandoned emails' },
      { status: 500 }
    );
  }
}