const fs = require('fs');
const path = require('path');

const detectProject = (repoPath) => {
    if (fs.existsSync(path.join(repoPath, 'package.json'))) {
        return 'nodejs';
    }
    if (fs.existsSync(path.join(repoPath, 'requirements.txt')) || fs.existsSync(path.join(repoPath, 'pyproject.toml'))) {
        return 'python';
    }
    return 'unknown';
};

module.exports = { detectProject };
