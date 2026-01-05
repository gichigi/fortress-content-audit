// This is a mock email service for demonstration purposes
// In a real application, you would use a service like SendGrid, Mailgun, etc.

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export type EmailTemplate = "purchase-confirmation" | "implementation-tips"

export interface EmailOptions {
  to: string
  subject?: string
  template: EmailTemplate
  variables?: Record<string, any>
}

export interface ScheduledEmailOptions extends EmailOptions {
  delay: string // e.g., '24h', '2d'
}

export interface EmailData {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  react?: React.ReactElement;
}

export interface ThankYouEmailData {
  customerEmail: string;
  customerName?: string;
  guidelineId?: string; // Use guidelineId instead of sessionId
  sessionId?: string; // Keep for backward compatibility
  amount: number;
  currency: string;
}

export interface AbandonedCartEmailData {
  customerEmail: string;
  customerName?: string;
  recoveryUrl: string;
  discountCode?: string;
  sessionId?: string;
}

export interface AuditCompletionEmailData {
  customerEmail: string;
  customerName?: string;
  domain: string;
  totalIssues: number;
  pagesAudited: number;
  auditId: string;
}

/**
 * Send an email using the specified template and variables
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  console.log(`Sending email to ${options.to} using template ${options.template}`)
  console.log("Variables:", options.variables)

  // In a real implementation, this would call your email service API
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`Email sent to ${options.to}`)
      resolve(true)
    }, 500)
  })
}

/**
 * Schedule an email to be sent after a delay
 */
export async function scheduleEmail(options: ScheduledEmailOptions): Promise<boolean> {
  console.log(`Scheduling email to ${options.to} with delay ${options.delay}`)

  // In a real implementation, this would use a task queue or scheduling service
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`Email scheduled for ${options.to}`)
      resolve(true)
    }, 500)
  })
}

/**
 * Generate a secure access token for email links
 */
export function generateSecureToken(): string {
  // In a real implementation, this would generate a cryptographically secure token
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

/**
 * Send a purchase confirmation email with access links
 */
export async function sendPurchaseConfirmationEmail(email: string, accessToken: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "Your Style Guide is Ready!",
    template: "purchase-confirmation",
    variables: {
      accessLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://aistyleguide.com'}/dashboard`,
      downloadLinks: {
        pdf: `https://styleguideai.com/download/pdf?token=${accessToken}`,
        markdown: `https://styleguideai.com/download/md?token=${accessToken}`,
        docx: `https://styleguideai.com/download/docx?token=${accessToken}`,
        html: `https://styleguideai.com/download/html?token=${accessToken}`,
      },
    },
  })
}

class EmailService {
  async sendEmail(data: EmailData) {
    try {
      if (!process.env.RESEND_API_KEY) {
        console.log('⚠️ RESEND_API_KEY not set - email not sent:', data.subject);
        return { success: false, error: 'No API key configured' };
      }

      const result = await resend.emails.send({
        from: 'Tahi from Fortress <support@aistyleguide.com>',
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
        react: data.react,
      });

      console.log('✅ Email sent successfully:', result.data?.id);
      return { success: true, id: result.data?.id };
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendThankYouEmail(data: ThankYouEmailData) {
    const subject = 'Thank you for using Fortress!';
    const html = this.generateThankYouEmailHTML(data);
    const text = this.generateThankYouEmailText(data);

    return this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
      text,
    });
  }

  async sendAbandonedCartEmail(data: AbandonedCartEmailData) {
    const subject = 'Complete Your Style Guide – 20% Off';
    const html = this.generateAbandonedCartEmailHTML(data);
    const text = this.generateAbandonedCartEmailText(data);

    return this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
      text,
    });
  }

  async sendAuditCompletionEmail(data: AuditCompletionEmailData) {
    const subject = `Your content audit for ${data.domain} is complete`;
    const html = this.generateAuditCompletionEmailHTML(data);
    const text = this.generateAuditCompletionEmailText(data);

    return this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
      text,
    });
  }

  private generateThankYouEmailHTML(data: ThankYouEmailData): string {
    const firstName = data.customerName ? data.customerName.split(' ')[0] : 'there';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thank you for using Fortress!</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <p style="margin-bottom: 20px;">Hey ${firstName},</p>
          
          <p style="margin-bottom: 15px;">I'm Tahi — I built Fortress to make content audits faster and more actionable.</p>
          
          <p style="margin-bottom: 15px;">Seeing your subscription come through today honestly made my week. 🙌</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0 0 15px 0; font-weight: 500;">If you have 2 minutes:</p>
            <ol style="margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">What problem were you hoping Fortress would solve?</li>
              <li style="margin-bottom: 8px;">What nearly stopped you from subscribing?</li>
              <li style="margin-bottom: 0;">Anything else you wanna share :)</li>
            </ol>
          </div>
          
          <p style="margin-bottom: 15px;">And if you've got questions about Fortress, here's my direct Calendly link (15 min, no pitch):</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://calendly.com/l-gichigi/customer-chat" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
              📅 Chat with Tahi (15 min)
            </a>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
               style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
              Access Your Dashboard
            </a>
          </div>
          
          <p style="margin-bottom: 15px;">Thanks again for being one of our very first customers. Anything you need, just hit reply — it's really me on the other end.</p>
          
          <p style="margin-bottom: 5px;">Cheers,<br>
          Tahi<br>
          Founder, Fortress<br>
          <a href="https://x.com/tahigichigi" style="color: #2563eb;">x.com/tahigichigi</a></p>
          
        </body>
      </html>
    `;
  }

  private generateThankYouEmailText(data: ThankYouEmailData): string {
    const firstName = data.customerName ? data.customerName.split(' ')[0] : 'there';
    
    return `Hey ${firstName},

I'm Tahi — I built Fortress to make content audits faster and more actionable.

Seeing your subscription come through today honestly made my week. 🙌

If you have 2 minutes:
1. What problem were you hoping Fortress would solve?
2. What nearly stopped you from subscribing?
3. Anything else you wanna share :)

And if you've got questions about Fortress, here's my direct Calendly link (15 min, no pitch): https://calendly.com/l-gichigi/customer-chat

Access your dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard

Thanks again for being one of our very first customers. Anything you need, just hit reply — it's really me on the other end.

Cheers,
Tahi
Founder, Fortress
x.com/tahigichigi`;
  }

  private generateAbandonedCartEmailHTML(data: AbandonedCartEmailData): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Complete Your Style Guide</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          
          <div style="margin-bottom: 40px;">
            <p style="font-size: 18px; margin-bottom: 30px;">Hey there,</p>
            
            <p style="font-size: 16px; margin-bottom: 30px;">I noticed you started creating your style guide but didn't finish. Totally get it - big decisions take time.</p>
            
            <p style="font-size: 16px; margin-bottom: 8px;">Here's 20% off when you're ready:</p>
            ${data.discountCode ? `<p style="font-size: 18px; font-weight: bold; margin-bottom: 30px;">${data.discountCode}</p>` : ''}
            
            <p style="font-size: 16px; margin-bottom: 30px;">Just add the code at checkout.</p>
            
            <p style="font-size: 16px; margin-bottom: 40px;">No pressure, just wanted to make sure you had it.</p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${data.recoveryUrl}" 
                 style="background: #333; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                Generate Your Style Guide
              </a>
            </div>
          </div>
          
          <div style="border-top: 1px solid #ddd; padding-top: 30px; margin-top: 40px;">
            <p style="font-size: 16px; margin-bottom: 8px;">Tahi</p>
            <p style="color: #666; font-size: 14px; margin-bottom: 8px;">Founder, Fortress</p>
            <p style="color: #666; font-size: 14px;">x.com/tahigichigi</p>
          </div>
        </body>
      </html>
    `;
  }

  private generateAbandonedCartEmailText(data: AbandonedCartEmailData): string {
    return `
Hey how's it going?

I noticed you started generating your content style guide but didn't finish. I know how busy things get.

Here's 20% off when you're ready: ${data.discountCode || 'COMEBACK20'}

Just add the code at checkout.

No pressure, just wanted to make sure you had it.

Generate Your Style Guide: ${data.recoveryUrl}

Tahi
Founder, Fortress

    `;
  }

  private generateAuditCompletionEmailHTML(data: AuditCompletionEmailData): string {
    const firstName = data.customerName ? data.customerName.split(' ')[0] : 'there';
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fortress.audit'}/dashboard`;
    const auditUrl = `${dashboardUrl}?audit=${data.auditId}`;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Content Audit is Complete</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <p style="margin-bottom: 20px;">Hey ${firstName},</p>
          
          <p style="margin-bottom: 15px;">Your content audit for <strong>${data.domain}</strong> is complete!</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0 0 10px 0; font-weight: 500;">Audit Summary:</p>
            <ul style="margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;"><strong>${data.totalIssues}</strong> issue${data.totalIssues === 1 ? '' : 's'} found</li>
              <li style="margin-bottom: 0;"><strong>${data.pagesAudited}</strong> page${data.pagesAudited === 1 ? '' : 's'} audited</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${auditUrl}" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
              View Audit Results
            </a>
          </div>
          
          <p style="margin-bottom: 15px;">Review the issues, track your health score over time, and export reports from your dashboard.</p>
          
          <p style="margin-bottom: 5px;">Cheers,<br>
          Tahi<br>
          Founder, Fortress<br>
          <a href="https://x.com/tahigichigi" style="color: #2563eb;">x.com/tahigichigi</a></p>
          
        </body>
      </html>
    `;
  }

  private generateAuditCompletionEmailText(data: AuditCompletionEmailData): string {
    const firstName = data.customerName ? data.customerName.split(' ')[0] : 'there';
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fortress.audit'}/dashboard`;
    const auditUrl = `${dashboardUrl}?audit=${data.auditId}`;
    
    return `Hey ${firstName},

Your content audit for ${data.domain} is complete!

Audit Summary:
- ${data.totalIssues} issue${data.totalIssues === 1 ? '' : 's'} found
- ${data.pagesAudited} page${data.pagesAudited === 1 ? '' : 's'} audited

View your audit results: ${auditUrl}

Review the issues, track your health score over time, and export reports from your dashboard.

Cheers,
Tahi
Founder, Fortress
x.com/tahigichigi`;
  }
}

export const emailService = new EmailService();
