const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const githubLogin = (req, res) => {
    const redirectUrl =
        "https://github.com/login/oauth/authorize" +
        `?client_id=${process.env.GITHUB_CLIENT_ID}` +
        "&scope=user:email";

  res.redirect(redirectUrl);
}

const githubCallback = async (req, res) => {
    const code = req.query.code;
    try{
        const tokenResponse = await axios.post(
            "https://github.com/login/oauth/access_token",
            {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            },
            {
                headers: { Accept: "application/json" },
            }
        );
        const accessToken = tokenResponse.data.access_token;
        // console.log(accessToken);
        const userResponse = await axios.get("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const user = userResponse.data;
        // console.log(user);   
        const findUser = await User.findOne({ username: user.login });
        if(!findUser){
            try{
                await User.create({
                    provider: "github",
                    externalId: user.id,
                    username: user.login,
                    email: user.email,
                    avatarUrl: user.avatar_url,
                    profileUrl: user.html_url
                });
            } catch (error) {
                return res.json({ success: false, msg: "Error creating Engineer" });
            }
        }
        const token = jwt.sign(
            { id: user.id, username: user.login },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // true in production (https)
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.redirect(`${process.env.FRONTEND_URL}/`);
    } catch (error){
        console.log(error);
        res.status(500).json({
            msg: "OAuth Failed"
        });
    }
}

module.exports = {
    githubLogin,
    githubCallback
}