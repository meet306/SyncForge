import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : null;

    if (user && pass) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        pool: true,
        maxConnections: 5,
        maxMessages: 100
      });
    } else {
      console.warn('[Email Warning] SMTP credentials not fully configured in environment.');
    }
  }
  return transporter;
}

export async function verifySMTP() {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.verify();
    console.log(`[SMTP Service] Connected and verified successfully to ${process.env.SMTP_HOST} as ${process.env.SMTP_USER}`);
    return true;
  } catch (err) {
    console.error('[SMTP Service Error] Verification failed:', err.message);
    return false;
  }
}

export async function sendWelcomeEmail(toEmail, userName) {
  const t = getTransporter();
  if (!t) return null;

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const from = process.env.EMAIL_FROM || `"SyncForge" <${process.env.SMTP_USER}>`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
          .content { padding: 32px 24px; line-height: 1.6; }
          .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 16px; }
          .footer { padding: 20px 24px; background: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to SyncForge</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${userName}</strong>,</p>
            <p>Welcome to <strong>SyncForge</strong> — your real-time collaborative document platform. Your account has been securely created and is ready to use.</p>
            <p>With SyncForge, you can:</p>
            <ul>
              <li>Create and edit rich documents concurrently with your team.</li>
              <li>Collaborate with live cursors and zero edit conflicts via CRDTs.</li>
              <li>Share documents securely with granular role controls (Owner, Editor, Viewer).</li>
            </ul>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${clientUrl}/dashboard" class="btn">Open Your Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} SyncForge. Production Real-Time Collaborative Architecture.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const info = await t.sendMail({
      from,
      to: toEmail,
      subject: 'Welcome to SyncForge — Your Collaborative Workspace',
      html
    });
    console.log(`[Email Service] Welcome email sent to ${toEmail}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[Email Service Error] Failed to send welcome email to ${toEmail}:`, err.message);
    return null;
  }
}

export async function sendDocumentInvitationEmail({
  toEmail,
  inviterName,
  inviterEmail,
  documentTitle,
  role,
  shareUrl
}) {
  const t = getTransporter();
  if (!t) return null;

  const from = process.env.EMAIL_FROM || `"SyncForge" <${process.env.SMTP_USER}>`;
  const roleName = role === 'editor' ? 'Editor (Can view and edit)' : 'Viewer (Read-only)';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
          .content { padding: 32px 24px; line-height: 1.6; }
          .doc-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .doc-title { font-size: 17px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; }
          .doc-role { font-size: 13px; color: #0284c7; font-weight: 600; }
          .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; }
          .footer { padding: 20px 24px; background: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Document Collaboration Invitation</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p><strong>${inviterName}</strong> (${inviterEmail}) has invited you to collaborate on a document in <strong>SyncForge</strong>.</p>
            
            <div class="doc-card">
              <div class="doc-title">${documentTitle}</div>
              <div class="doc-role">Permission: ${roleName}</div>
            </div>

            <p>You can jump directly into the document and work in real time with the team:</p>
            
            <div style="text-align: center; margin: 28px 0;">
              <a href="${shareUrl}" class="btn">Open Document in SyncForge</a>
            </div>

            <p style="font-size: 13px; color: #64748b;">Or paste this link into your browser:<br>
              <a href="${shareUrl}" style="color: #2563eb; word-break: break-all;">${shareUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} SyncForge. Scalable Real-Time Collaborative Workspace.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const info = await t.sendMail({
      from,
      to: toEmail,
      subject: `${inviterName} invited you to collaborate on "${documentTitle}" — SyncForge`,
      html
    });
    console.log(`[Email Service] Collaboration invitation email sent to ${toEmail}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[Email Service Error] Failed to send invitation email to ${toEmail}:`, err.message);
    return null;
  }
}
