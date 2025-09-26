const sgMail = require("@sendgrid/mail");

// Set SendGrid API key from environment variable
if (process.env.SENDGRID_API_KEY || process.env.SENDGRID_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY || process.env.SENDGRID_KEY);
}

const sendEmail = async (to, subject, content) => {
  const fromEmail = process.env.FROM_EMAIL || "noreply@thebandplan.com";

  const msg = {
    to,
    from: fromEmail,
    subject,
    html: content,
    text: content.replace(/<[^>]*>/g, ""), // Strip HTML tags for text version
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    if (error.response) {
      console.error("SendGrid error details:", error.response.body);
    }
    throw error;
  }
};

const sendBandInvitation = async (invitation, band, inviterName) => {
  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://thebandplan.com"
      : process.env.BASE_URL || "http://localhost:3000";
  const invitationUrl = `${baseUrl}/invite/${invitation.token}`;

  const fromEmail = process.env.FROM_EMAIL || "noreply@thebandplan.com";

  const msg = {
    to: invitation.email,
    from: fromEmail,
    subject: `🎵 You're invited to join ${band.name}!`,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">🎵 Band Invitation</h2>
                
                <p><strong>${inviterName}</strong> has invited you to collaborate on setlists with <strong>${band.name}</strong>.</p>
                
                ${band.description ? `<p style="font-style: italic; color: #666;">"${band.description}"</p>` : ""}
                
                <div style="margin: 30px 0;">
                    <a href="${invitationUrl}" 
                       style="background-color: #007bff; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Accept Invitation
                    </a>
                </div>
                
                <p style="font-size: 14px; color: #666;">
                    Or copy and paste this link into your browser:<br>
                    <a href="${invitationUrl}">${invitationUrl}</a>
                </p>
                
                <p style="font-size: 12px; color: #999;">
                    This invitation expires on ${invitation.expires_at.toLocaleDateString()}.
                    If you don't want to receive these emails, you can ignore this message.
                </p>
            </div>
        `,
    text: `
You're invited to join ${band.name}!

${inviterName} has invited you to collaborate on setlists with ${band.name}.

${band.description ? `"${band.description}"` : ""}

Accept your invitation by visiting: ${invitationUrl}

This invitation expires on ${invitation.expires_at.toLocaleDateString()}.
        `,
  };

  try {
    await sgMail.send(msg);
    console.log(`Invitation email sent to ${invitation.email}`);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    if (error.response) {
      console.error("SendGrid error details:", error.response.body);
    }
    return false;
  }
};

const sendBandInvitationNotification = async (
  invitation,
  band,
  inviterName,
  userEmail
) => {
  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://thebandplan.com"
      : process.env.BASE_URL || "http://localhost:3000";
  const dashboardUrl = `${baseUrl}/`;

  const fromEmail = process.env.FROM_EMAIL || "noreply@thebandplan.com";

  const msg = {
    to: userEmail,
    from: fromEmail,
    subject: `🎵 You've been added to ${band.name}!`,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">🎵 Welcome to ${band.name}!</h2>
                
                <p><strong>${inviterName}</strong> has added you to collaborate on setlists with <strong>${band.name}</strong>.</p>
                
                ${band.description ? `<p style="font-style: italic; color: #666;">"${band.description}"</p>` : ""}
                
                <div style="margin: 30px 0;">
                    <a href="${dashboardUrl}" 
                       style="background-color: #28a745; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        View Your Dashboard
                    </a>
                </div>
                
                <p style="font-size: 14px; color: #666;">
                    Or copy and paste this link into your browser:<br>
                    <a href="${dashboardUrl}">${dashboardUrl}</a>
                </p>
                
                <p style="font-size: 12px; color: #999;">
                    You can now access ${band.name} from your dashboard. If you don't want to receive these emails, you can ignore this message.
                </p>
            </div>
        `,
    text: `
You've been added to ${band.name}!

${inviterName} has added you to collaborate on setlists with ${band.name}.

${band.description ? `"${band.description}"` : ""}

Visit your dashboard to see the band: ${dashboardUrl}

You can now access ${band.name} from your dashboard.
        `,
  };

  try {
    await sgMail.send(msg);
    console.log(`Band notification email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    if (error.response) {
      console.error("SendGrid error details:", error.response.body);
    }
    return false;
  }
};

module.exports = {
  sendBandInvitation,
  sendBandInvitationNotification,
  sendEmail,
};
