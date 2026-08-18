const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const execPromise = util.promisify(exec);
const { detectProject } = require('../utils/projectDetector');
const fs = require('fs');
const fsPromises = require('fs').promises;

const runCI = async (repoUrl, commitSha, workDir) => {
    const repoPath = path.join(workDir, 'repo');
    let logs = '';

    const runCommand = async (command, cwd = repoPath) => {
        logs += `> ${command}\n`;
        try {
            const { stdout, stderr } = await execPromise(command, { cwd });
            logs += stdout + '\n';
            if (stderr) logs += stderr + '\n';
            return true;
        } catch (error) {
            logs += error.stdout ? error.stdout + '\n' : '';
            logs += error.stderr ? error.stderr + '\n' : '';
            logs += `Command failed: ${error.message}\n`;
            throw new Error(`Command failed: ${command}`);
        }
    };

    try {
        logs += '[checkout] Cloning repository...\n';
        // Need to handle public/private repos; assuming public or token embedded in repoUrl for now
        await execPromise(`git clone ${repoUrl} ${repoPath}`, { cwd: workDir });
        
        if (commitSha) {
            logs += `[checkout] Checkout commit ${commitSha}\n`;
            await runCommand(`git checkout ${commitSha}`);
        }

        const projectType = detectProject(repoPath);
        logs += `[detect] Project type detected: ${projectType}\n`;

        if (projectType === 'unknown') {
            throw new Error('Unsupported project type.');
        }

        if (projectType === 'nodejs') {
            logs += '[dependencies] Installing dependencies...\n';
            // Use npm ci if package-lock.json exists, else npm install
            if (fs.existsSync(path.join(repoPath, 'package-lock.json'))) {
                await runCommand('npm ci');
            } else {
                await runCommand('npm install');
            }
            
            logs += '[test] Running tests...\n';
            const packageJson = JSON.parse(await fsPromises.readFile(path.join(repoPath, 'package.json'), 'utf8'));
            if (packageJson.scripts && packageJson.scripts.test) {
                await runCommand('npm test');
            } else {
                logs += 'No test script found in package.json. Skipping tests.\n';
            }

            if (packageJson.scripts && packageJson.scripts.build) {
                logs += '[build] Running build...\n';
                await runCommand('npm run build');
            }
        } else if (projectType === 'python') {
            logs += '[dependencies] Installing dependencies...\n';
            if (fs.existsSync(path.join(repoPath, 'requirements.txt'))) {
                await runCommand('pip install -r requirements.txt');
            }
            
            logs += '[test] Running tests...\n';
            await runCommand('pytest');
        }

        return { status: 'success', logs };
    } catch (error) {
        return { status: 'failed', logs, error: error.message };
    }
};

module.exports = { runCI };
