const axios = require("axios");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../../models/User");
const OAuthAccount = require("../../models/OAuthAccount");
const WebhookKey = require("../../models/WebhookKey");
const { verifyContributorsForOAuthUser } = require("../../services/contributorService");


// STEP 1: Redirect user to Bitbucket
const bitbucketLogin = (req, res) => {

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUrl =
    "https://bitbucket.org/site/oauth2/authorize" +
    `?client_id=${process.env.BITBUCKET_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.BITBUCKET_REDIRECT_URI)}` +
    "&response_type=code" +
    `&state=${state}`;

  res.redirect(redirectUrl);
};


// STEP 2: Callback
const bitbucketCallback = async (req, res) => {

  const code = req.query.code;

  try {

    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://bitbucket.org/site/oauth2/access_token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.BITBUCKET_REDIRECT_URI
      }),
      {
        auth: {
          username: process.env.BITBUCKET_CLIENT_ID,
          password: process.env.BITBUCKET_CLIENT_SECRET
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Fetch user profile
    const userResponse = await axios.get(
      "https://api.bitbucket.org/2.0/user",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const bitbucketUser = userResponse.data;

    // Fetch email
    const emailResponse = await axios.get(
      "https://api.bitbucket.org/2.0/user/emails",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const email =
      emailResponse.data.values.find(e => e.is_primary)?.email || null;

    // Check OAuth account
    let account = await OAuthAccount.findOne({
      provider: "bitbucket",
      providerUserId: bitbucketUser.uuid
    });

    let user;

    if (account) {

      user = await User.findById(account.userId);

    } else {

      user = await User.findOne({ email });

      if (!user) {

        user = await User.create({
          name: bitbucketUser.display_name,
          email,
          avatarUrl: bitbucketUser.links.avatar.href
        });

      }

      await OAuthAccount.create({
        userId: user._id,
        provider: "bitbucket",
        providerUserId: bitbucketUser.uuid,
        username: bitbucketUser.display_name,
        avatarUrl: bitbucketUser.links.avatar.href,
        profileUrl: bitbucketUser.links.html.href,
        accessToken
      });

      // Create webhook key if not exists
      let webhook = await WebhookKey.findOne({
        userId: user._id,
        provider: "bitbucket"
      });

      if (!webhook) {

        const key = crypto.randomBytes(24).toString("hex");

        await WebhookKey.create({
          userId: user._id,
          provider: "bitbucket",
          key
        });

      }
    }

    await verifyContributorsForOAuthUser({
      userId: user._id,
      platform: "bitbucket",
      providerUserId: bitbucketUser.uuid,
      username: bitbucketUser.username || bitbucketUser.display_name,
      email: email || undefined,
      avatarUrl: bitbucketUser.links?.avatar?.href,
      name: bitbucketUser.display_name
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.redirect(process.env.FRONTEND_URL);

  } catch (error) {

    console.error("Bitbucket OAuth Error:", error);

    res.status(500).json({
      msg: "Bitbucket OAuth Failed"
    });
  }
};

module.exports = {
  bitbucketLogin,
  bitbucketCallback
};