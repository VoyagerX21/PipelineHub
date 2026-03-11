const Repository = require('../models/Repository.js');

const allRepo = async (req, res) => {
    try{
        const userId = req.params.userId;
        const repos = await Repository.find({ownerId: userId});
        return res.status(200).json({
            success: true,
            repos
        });
    }
    catch (error) {
        console.log(error);
    }
}

module.exports = {
    allRepo
}