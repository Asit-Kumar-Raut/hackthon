const express = require("express");
const router = express.Router();
const User = require("../b/b");
const nodemailer = require("nodemailer");

// REGISTER
router.post("/register", async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.json({
            message: "Registered successfully"
        });
    } catch {
        res.status(500).json({
            message: "Registration failed"
        });
    }
});

// SEND ALERT EMAIL
router.post("/send-alert", async (req, res) => {
    try {
        const users = await User.find();
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        for (let user of users) {
            await transporter.sendMail({
                from: `"AI Monitoring System" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: "🚨 Unauthorized Area Alert",
                html: `
                <div style="
                background:black;
                color:red;
                padding:20px;
                border:2px solid red;
                ">
                <h2>Unauthorized Area Detected</h2>
                <p>Hello ${user.name}</p>
                <p>
                Unauthorized access detected.
                </p>
                <a href="${process.env.CLIENT_URL}/unauthorized"
                style="
                background:red;
                color:black;
                padding:12px;
                text-decoration:none;
                font-weight:bold;
                ">
                View Unauthorized Area
                </a>
                </div>
                `
            });
        }
        res.json({
            message: "Alert Email Sent"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Email Failed"
        });
    }
});

module.exports = router;
