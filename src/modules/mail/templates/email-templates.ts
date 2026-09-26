/**
 * PlanetU HRMS - Email Notification Templates
 * Responsive, inline-styled HTML email generator.
 * Designed to render consistently across Gmail, Outlook, Apple Mail, and mobile clients.
 */

export interface EmailRenderInput {
  recipientName: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Returns a color palette based on notification type and priority.
 */
function getBadgeStyle(type: string, metadata?: Record<string, any>): { bg: string; text: string; label: string } {
  switch (type) {
    case 'LEAVE_STATUS': {
      const status = metadata?.status?.toUpperCase();
      if (status === 'APPROVED') return { bg: '#ecfdf5', text: '#065f46', label: 'LEAVE APPROVED' };
      if (status === 'REJECTED') return { bg: '#fef2f2', text: '#991b1b', label: 'LEAVE REJECTED' };
      return { bg: '#eff6ff', text: '#1e40af', label: 'LEAVE UPDATE' };
    }
    case 'PAYSLIP_RELEASED':
      return { bg: '#f0fdf4', text: '#166534', label: 'PAYSLIP PUBLISHED' };
    case 'BONUS_AWARDED':
      return { bg: '#ecfdf5', text: '#065f46', label: 'BONUS AWARDED' };
    case 'ATTENDANCE_ALERT':
      return { bg: '#fffbeb', text: '#92400e', label: 'ATTENDANCE ALERT' };
    case 'SHIFT_ASSIGNED':
      return { bg: '#eef2ff', text: '#3730a3', label: 'SHIFT ASSIGNMENT' };
    case 'CLEARANCE_TASK':
      return { bg: '#fff7ed', text: '#9a3412', label: 'OFFBOARDING TASK' };
    case 'TERMINATION_NOTICE':
      return { bg: '#fef2f2', text: '#991b1b', label: 'OFFICIAL NOTICE' };
    case 'ANNOUNCEMENT': {
      const priority = metadata?.priority?.toUpperCase();
      if (priority === 'URGENT') return { bg: '#fef2f2', text: '#991b1b', label: 'URGENT ANNOUNCEMENT' };
      return { bg: '#f5f3ff', text: '#5b21b6', label: 'COMPANY ANNOUNCEMENT' };
    }
    case 'TEST_EMAIL':
      return { bg: '#f0fdf4', text: '#15803d', label: 'TEST CONNECTION' };
    default:
      return { bg: '#f8fafc', text: '#334155', label: 'NOTIFICATION' };
  }
}

/**
 * Generates rich HTML content based on notification category.
 */
export function renderEmailTemplate(input: EmailRenderInput): RenderedEmail {
  const { recipientName, type, title, message, actionUrl, metadata } = input;
  const badge = getBadgeStyle(type, metadata);
  const subject = `[PlanetU HRMS] ${title}`;

  // Build metadata detail rows if available
  let detailRows = '';
  if (metadata && Object.keys(metadata).length > 0) {
    const rows: string[] = [];
    if (metadata.leaveTypeName) {
      rows.push(`<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 500;">Leave Type:</td><td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">${metadata.leaveTypeName}</td></tr>`);
    }
    if (metadata.startDate && metadata.endDate) {
      rows.push(`<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 500;">Duration:</td><td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">${metadata.startDate} to ${metadata.endDate}</td></tr>`);
    }
    if (metadata.month && metadata.year) {
      rows.push(`<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 500;">Period:</td><td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">${metadata.month}/${metadata.year}</td></tr>`);
    }
    if (metadata.shiftName) {
      rows.push(`<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 500;">Shift Schedule:</td><td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">${metadata.shiftName}</td></tr>`);
    }
    if (metadata.noticePeriodDays) {
      rows.push(`<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 500;">Notice Period:</td><td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">${metadata.noticePeriodDays} Days</td></tr>`);
    }
    if (metadata.dateOfExit) {
      rows.push(`<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 500;">Effective Last Day:</td><td style="padding: 8px 0; color: #991b1b; font-size: 13px; font-weight: 600; text-align: right;">${metadata.dateOfExit}</td></tr>`);
    }
    if (rows.length > 0) {
      detailRows = `
        <div style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>
      `;
    }
  }

  // Action Button
  const actionButtonHtml = actionUrl
    ? `
      <div style="margin: 28px 0 12px 0;">
        <a href="${actionUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
          View in PlanetU HRMS &rarr;
        </a>
      </div>
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">Or copy this link to your browser: <br/><a href="${actionUrl}" style="color: #6366f1; word-break: break-all;">${actionUrl}</a></p>
    `
    : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
          <!-- Brand Header -->
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
                      Planet<span style="color: #818cf8;">U</span> HRMS
                    </div>
                    <div style="color: #c7d2fe; font-size: 12px; margin-top: 2px;">
                      Enterprise Workforce Management Platform
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <!-- Badge -->
              <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background-color: ${badge.bg}; color: ${badge.text}; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 16px;">
                ${badge.label}
              </div>

              <h1 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700; line-height: 1.3;">
                ${title}
              </h1>

              <p style="margin: 0 0 16px 0; color: #334155; font-size: 15px; line-height: 1.6;">
                Hello <strong>${recipientName || 'Team Member'}</strong>,
              </p>

              <div style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
                ${message}
              </div>

              ${detailRows}

              ${actionButtonHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;">
                You received this email because of activity associated with your PlanetU HRMS account.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} PlanetU HRMS &bull; All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
[PlanetU HRMS] ${title}

Hello ${recipientName || 'Team Member'},

${message}

${actionUrl ? `Action URL: ${actionUrl}` : ''}

© ${new Date().getFullYear()} PlanetU HRMS. All rights reserved.
  `.trim();

  return { subject, html, text };
}
