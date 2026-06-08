const User = require('../../models/User');
const OAuthAccount = require('../../models/OAuthAccount');
const WebhookKey = require('../../models/WebhookKey');
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const emailjs = require("@emailjs/nodejs");
const Token = require('../../models/ForgetPassToken');

const handleLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                msg: "No such Engineer exists"
            });
        }

        if (!user.password) {
            return res.status(400).json({
                success: false,
                msg: "Set password first"
            });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({
                success: false,
                msg: "Incorrect username or password"
            });
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // set true in production
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.json({
            success: true,
            msg: "Login successful",
            authenticated: true,
            user
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            msg: "Internal server error"
        });
    }
};

const getMe = async (req, res) => {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({
            success: false,
            authenticated: false
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                authenticated: false
            });
        }

        return res.json({
            success: true,
            authenticated: true,
            user
        });

    } catch (err) {
        return res.status(401).json({
            success: false,
            authenticated: false
        });
    }
};

const getProviders = async (req, res) => {
    try {
        const userId = req.params.userId;
        // console.log(userId);
        const user = await User.findById(userId);
        // console.log(user);
        const accounts = await OAuthAccount.find({ userId });
        // console.log(accounts);
        const providers = {
            github: false,
            gitlab: false,
            bitbucket: false,
            githubkey: "",
            gitlabkey: "",
            bitbucketkey: "",
            slackChannel: user.SlackChannelName,
            slackURL: user.SlackURL,
        };

        for (const acc of accounts) {
            providers[acc.provider] = true;

            const key = await WebhookKey.findOne({
                userId: userId,
                provider: acc.provider
            });

            if (key) {
                providers[acc.provider + "key"] = key.key;
            }
        }

        return res.json({
            success: true,
            providers
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            msg: "Failed to fetch providers"
        });
    }
};

const forgotPass = async (req, res) => {
    try {
        const { email } = req.body;
        // email validation needs to be done whether this is an email or not
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({
                success: false,
                msg: "Invalid credentials"
            })
        }
        const token = jwt.sign(
            {
                userId: user._id,
                username: user.username
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );
        const link = `${process.env.FRONTEND_URL}/reset-password/${token}`;
        emailjs.init({
            publicKey: process.env.EMAILJS_PUBLIC_KEY,
            privateKey: process.env.EMAILJS_PRIVATE_KEY
        });
        const service_id = "service_2gjyb8j";
        const template_id = "template_ppd75xv";
        const templateParams = {
            "email": user.email,
            "link": link
        }
        await Token.create({
            userId: user.id,
            token
        });

        const result = await emailjs.send(
            service_id,
            template_id,
            templateParams
        );

        if (result.status !== 200) {
            await Token.deleteMany({ userId: user._id })

            return res.status(500).json({
                success: false,
                msg: "Email service failure"
            });
        }

        return res.status(200).json({
            success: true,
            msg: "Verification link sent!"
        });
    } catch (e) {
        return res.status(500).json({
            success: false,
            msg: "Internal server error"
        })
    }
}

const authenticateChangePass = async (req, res) => {
    try {
        token = req.params?.token;
        if (!token) {
            return res.status(401).json({
                success: false,
                msg: "Token missing"
            })
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    authenticated: false
                });
            }
            const tokenObj = await Token.findOne({ userId: decoded.userId });
            if (tokenObj.token == token) {
                return res.status(200).json({
                    success: true,
                    msg: "Token Verified"
                })
            }
            else {
                return res.status(401).json({
                    success: true,
                    msg: "token already used or expired"
                })
            }
            return res.json({
                success: true,
                authenticated: true
            });
        } catch (err) {
            return res.status(401).json({
                success: false,
                authenticated: false
            });
        }
    } catch (e) {
        return res.status(500).json({
            success: false,
            msg: "Internal server error"
        })
    }
}

const updatePass = async (req, res) => {
    try {
        const { password, token } = req.body;
        if (!token && !password) {
            return res.status(401).json({
                success: false,
                msg: "Request body missing"
            })
        }
        if (!token || !password) {
            return res.status(401).json({
                success: false,
                msg: "Required fields are missing"
            })
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    authenticated: false
                });
            }
            const tokenObj = await Token.findOne({ userId: decoded.userId });
            if (tokenObj.token === token) {
                const pass = await bcrypt.hash(password, 10);
                user.password = pass;
                await user.save();
                await Token.deleteMany({ userId: decoded.userId })
                return res.status(200).json({
                    success: true,
                    msg: "Password updated"
                })
            }
            else {
                return res.status(401).json({
                    success: true,
                    msg: "token already used"
                })
            }
            return res.json({
                success: true,
                authenticated: true,
            });
        } catch (err) {
            console.log(err)
            return res.status(401).json({
                success: false,
                authenticated: false
            });
        }
    } catch (e) {
        return res.status(500).json({
            success: true,
            msg: "Internal server Error"
        })
    }
}

const logout = async (req, res) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production"
                ? "none"
                : "lax"
        });

        return res.status(200).json({
            success: true,
            msg: "Logged out successfully"
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false,
            msg: "Internal server Error"
        });
    }
};

module.exports = {
    handleLogin,
    getMe,
    getProviders,
    forgotPass,
    authenticateChangePass,
    updatePass,
    logout
}