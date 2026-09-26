#!/usr/bin/env node
/**
 * PlanetU HRMS - Standalone Real-Time Email Dispatch Verification Script
 * Tests live SMTP delivery (Resend, Gmail, Brevo, AWS SES) directly from terminal.
 *
 * Usage:
 *   node --env-file=.env scripts/test-mail.js [recipient@email.com]
 *   npm run test:mail [recipient@email.com]
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Manually parse .env as fallback in case --env-file was omitted
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let key = match[1];
        let value = match[2] ? match[2].trim() : '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

async function run() {
  console.log('\n======================================================');
  console.log('  🚀 PlanetU HRMS - Real-Time Email Delivery Tester');
  console.log('======================================================\n');

  const host = process.env.SMTP_HOST || 'smtp.resend.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.MAIL_FROM || 'PlanetU HRMS <onboarding@resend.dev>';

  // Recipient from command line argument
  const targetEmail = process.argv[2]?.trim();

  if (!targetEmail) {
    console.error('❌ Missing recipient email address!');
    console.error('👉 Usage: npm run test:mail <your-email@gmail.com>\n');
    process.exit(1);
  }

  if (!pass) {
    console.error('❌ SMTP_PASS is missing in your .env file!');
    console.log('\nFor Resend:');
    console.log('1. Go to https://resend.com -> Create API Key');
    console.log('2. Set SMTP_PASS="re_your_key_here" in .env');
    console.log('3. Set SMTP_USER="resend"');
    console.log('4. Set SMTP_HOST="smtp.resend.com"');
    console.log('5. Set MAIL_FROM="PlanetU HRMS <onboarding@resend.dev>"\n');
    process.exit(1);
  }

  console.log(`📡 Connecting to SMTP Server: ${host}:${port} (secure: ${secure})`);
  console.log(`👤 Authenticating as:         ${user}`);
  console.log(`✉️  Sender (From):             ${from}`);
  console.log(`🎯 Recipient (To):            ${targetEmail}\n`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    process.stdout.write('⏳ Verifying SMTP server credentials... ');
    await transporter.verify();
    console.log('✅ Connected!\n');
  } catch (verifyErr) {
    console.log('❌ Authentication Failed!');
    console.error(`\nError details: ${verifyErr.message}\n`);
    if (host.includes('resend')) {
      console.log('💡 Tip for Resend:');
      console.log('   - Make sure SMTP_USER="resend"');
      console.log('   - Make sure SMTP_PASS starts with "re_"');
      console.log('   - Make sure MAIL_FROM uses "onboarding@resend.dev" until you verify your domain.');
    }
    process.exit(1);
  }

  const timestamp = new Date().toLocaleString();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>PlanetU Real-Time Email Test</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);">
              <div style="color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">
                Planet<span style="color: #818cf8;">U</span> HRMS
              </div>
              <div style="color: #c7d2fe; font-size: 13px; margin-top: 4px;">
                Real-Time Email Notification System
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background-color: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
                ✅ LIVE DELIVERY VERIFIED
              </div>
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px;">
                Real-Time Email Dispatch is Active!
              </h2>
              <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
                Congratulations! Your PlanetU HRMS background email engine successfully delivered this message to your real inbox.
              </p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Delivered To:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${targetEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">SMTP Provider:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${host}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Timestamp:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${timestamp}</td>
                  </tr>
                </table>
              </div>
              <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0;">
                All HR actions (Leave approvals, Payslips, Attendance alerts, and Announcements) are now wired to deliver to real recipient mailboxes automatically.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} PlanetU HRMS &bull; Enterprise Workforce Management Platform
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

  try {
    process.stdout.write('📤 Sending email... ');
    const info = await transporter.sendMail({
      from,
      to: targetEmail,
      subject: '[PlanetU HRMS] 🎉 Real-Time Email Delivery Confirmed!',
      text: `Hello!\n\nYour PlanetU HRMS real-time email notification engine has successfully sent this message to ${targetEmail} at ${timestamp}.\n\nHRMS is ready to send leave updates, payslips, and alerts!`,
      html,
    });

    console.log('🎉 Dispatched!\n');
    console.log('------------------------------------------------------');
    console.log(`✅ Message ID:    ${info.messageId}`);
    console.log(`📬 Delivered To:   ${targetEmail}`);
    console.log('------------------------------------------------------');
    console.log('\n👉 Open your inbox (and check Spam / Promotions folder just in case)!');
  } catch (sendErr) {
    console.log('❌ Sending Failed!');
    console.error(`\nError: ${sendErr.message}\n`);
    if (host.includes('resend') && sendErr.message.includes('validation_error')) {
      console.log('💡 Note for Resend Free Tier:');
      console.log('   Until you verify your own domain on Resend, you can only send emails to the');
      console.log('   email address you used to register your Resend account, using:');
      console.log('   MAIL_FROM="PlanetU HRMS <onboarding@resend.dev>"\n');
    }
  }
}

run();
