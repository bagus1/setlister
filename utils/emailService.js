const sgMail = require('@sendgrid/mail');

// Set SendGrid API key from environment variable
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const sendBandInvitation = async (invitation, band, inviterName) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const invitationUrl = `${baseUrl}/invite/${invitation.token}`;
    
    const fromEmail = process.env.FROM_EMAIL || 'noreply@setlistmanager.com';
    console.log('DEBUG: FROM_EMAIL environment variable:', process.env.FROM_EMAIL);
    console.log('DEBUG: Using from email:', fromEmail);

    const msg = {
        to: invitation.email,
        from: fromEmail,
        subject: `🎵 You're invited to join ${band.name}!`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">🎵 Band Invitation</h2>
                
                <p><strong>${inviterName}</strong> has invited you to collaborate on setlists with <strong>${band.name}</strong>.</p>
                
                ${band.description ? `<p style="font-style: italic; color: #666;">"${band.description}"</p>` : ''}
                
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
                    This invitation expires on ${invitation.expiresAt.toLocaleDateString()}.
                    If you don't want to receive these emails, you can ignore this message.
                </p>
            </div>
        `,
        text: `
You're invited to join ${band.name}!

${inviterName} has invited you to collaborate on setlists with ${band.name}.

${band.description ? `"${band.description}"` : ''}

Accept your invitation by visiting: ${invitationUrl}

This invitation expires on ${invitation.expiresAt.toLocaleDateString()}.
        `
    };

    try {
        await sgMail.send(msg);
        console.log(`Invitation email sent to ${invitation.email}`);
        return true;
    } catch (error) {
        console.error('Email sending error:', error);
        if (error.response) {
            console.error('SendGrid error details:', error.response.body);
        }
        return false;
    }
};

module.exports = {
    sendBandInvitation
}; 