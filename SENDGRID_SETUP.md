# 📧 SendGrid Email Invitation Setup Guide

## 🎯 **What We Built**

Your setlist app now has **professional email invitations**! Instead of requiring users to register first, band owners can invite anyone by email with unique invitation links.

## 🚀 **Quick Setup Steps**

### 1. **Get SendGrid API Key** (FREE)
1. Visit [SendGrid.com](https://sendgrid.com)
2. Sign up for free account (100 emails/day)
3. Go to Settings → API Keys
4. Create new API key with "Full Access"
5. Copy the API key (starts with `SG.`)

### 2. **Configure Environment Variables**
Create a `.env` file in your project root:

```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.your_actual_api_key_here
FROM_EMAIL=noreply@yourdomain.com

# Application Configuration  
BASE_URL=http://localhost:3000
```

### 3. **Start the Server**
```bash
npm start
```

## 🎵 **How It Works**

### **For Band Owners:**
1. Go to band page → "Invite Member"
2. Enter any email address
3. System sends beautiful invitation email
4. Shows success: "Invitation sent to email! They have 7 days to accept."

### **For Recipients:**
1. Receive email: "🎵 You're invited to join [Band Name]!"
2. Click "Accept Invitation" button
3. **If they don't have account:** Auto-registration form
4. **If they have account:** Login form
5. Automatically added to band and logged in

### **Email Features:**
- ✨ Beautiful HTML templates
- 🔒 Secure unique tokens (7-day expiry)
- 📱 Mobile-friendly design
- ⚡ One-click acceptance
- 🎯 Handles existing/new users automatically

## 🛡️ **Security Features**

- **Unique tokens** for each invitation
- **Expiration dates** (7 days)
- **Single-use** invitations
- **Duplicate prevention** (can't invite same email twice)
- **Band ownership verification** (only owners can invite)

## 🧪 **Testing**

1. Create a test band
2. Invite yourself with different email
3. Check your email for invitation
4. Click link and complete signup/login
5. Verify you're added to the band

## 📝 **Email Configuration Options**

### **Custom Domain (Optional)**
```bash
FROM_EMAIL=invitations@yourbandname.com
```

### **Production URL**
```bash
BASE_URL=https://yourapp.herokuapp.com
```

## 🎯 **What Changed**

### **New Files:**
- `models/BandInvitation.js` - Database model for tracking invitations
- `utils/emailService.js` - SendGrid email sending service
- `routes/invitations.js` - Invitation acceptance routes
- `views/invitations/accept.ejs` - Beautiful invitation page

### **Updated Files:**
- `routes/bands.js` - Now sends emails instead of requiring existing users
- `models/index.js` - Added BandInvitation model
- `server.js` - Added invitation routes
- `package.json` - Added SendGrid dependencies

## 💫 **Benefits**

✅ **Better UX** - No "user not found" errors  
✅ **Professional** - Real email invitation workflow  
✅ **Secure** - Tokens, expiration, single-use  
✅ **Flexible** - Works for new and existing users  
✅ **Beautiful** - Styled HTML emails with your branding  

## 🆘 **Troubleshooting**

**Email not sending?**
- Check `SENDGRID_API_KEY` is correct
- Verify `FROM_EMAIL` domain (use SendGrid verified sender)
- Check console for SendGrid errors

**"Invitation expired"?**
- Invitations expire after 7 days
- Send a new invitation

**Still getting "user not found"?**
- Make sure you imported the new routes in `server.js`
- Restart your server after adding `.env` file

---

**🎉 Your app now has professional-grade email invitations!** 

Test it out and invite some friends to your bands! 🎸🥁🎹 