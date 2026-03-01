const twilio = require('twilio');

// You need to set these in your .env file
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client only if credentials exist
let client = null;
if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
}

const sendSMSAlert = async (to, message) => {
    if (!client) {
        console.warn('Twilio credentials not found. SMS not sent:', message);
        return false;
    }

    try {
        const result = await client.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: to
        });
        console.log(`SMS sent to ${to}, SID: ${result.sid}`);
        return true;
    } catch (error) {
        console.error('Error sending SMS:', error);
        return false;
    }
};

module.exports = {
    sendSMSAlert
};
