const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const notificationQueue = require('../queues/notificationQueue');

const PipelineRun = require('../models/PipelineRun');
const Repository = require('../models/Repository');
const { runCI } = require('../services/ciRunner');
const os = require('os');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

const pipelineWorker = new Worker('pipeline-queue', async job => {
  const { pipeline_id, event_id, repository_id, provider, branch, payload } = job.data;
  console.log(`[Pipeline Worker] Processing job ${job.id} for pipeline ${pipeline_id}`);
  
  const pipelineRun = await PipelineRun.findById(pipeline_id);
  if (!pipelineRun) {
    throw new Error(`PipelineRun not found: ${pipeline_id}`);
  }

  const repo = await Repository.findById(repository_id);
  if (!repo) {
    throw new Error(`Repository not found: ${repository_id}`);
  }

  pipelineRun.status = 'running';
  pipelineRun.startedAt = new Date();
  await pipelineRun.save();

  // Create temporary working directory for this pipeline run
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `pipeline-${pipeline_id}-`));

  let repoUrl;
  let commitSha;
  
  if (provider === 'github') {
    repoUrl = payload.repository?.clone_url;
    commitSha = payload.after || payload.head_commit?.id || payload.pull_request?.head?.sha;
  } else if (provider === 'gitlab') {
    repoUrl = payload.project?.http_url;
    commitSha = payload.checkout_sha || payload.after || payload.object_attributes?.last_commit?.id;
  } else if (provider === 'bitbucket') {
    repoUrl = payload.repository?.links?.html?.href;
    commitSha = payload.push?.changes?.[0]?.new?.target?.hash || payload.pullrequest?.source?.commit?.hash;
  }

  if (!repoUrl) {
    repoUrl = `https://${provider}.com/${repo.fullName}.git`;
  }

  let ciResult;
  try {
    ciResult = await runCI(repoUrl, commitSha, workDir);
  } finally {
    // Cleanup workDir
    try {
        await fsPromises.rm(workDir, { recursive: true, force: true });
    } catch (e) {
        console.error(`Failed to cleanup workDir ${workDir}:`, e);
    }
  }

  pipelineRun.status = ciResult.status === 'success' ? 'success' : 'failed';
  pipelineRun.logs = ciResult.logs;
  if (ciResult.error) {
    pipelineRun.failureReason = ciResult.error;
  }
  pipelineRun.completedAt = new Date();
  pipelineRun.durationMs = pipelineRun.completedAt - pipelineRun.startedAt;
  await pipelineRun.save();

  console.log(`[Pipeline Worker] Finished job ${job.id} with status ${pipelineRun.status}`);
  
  await notificationQueue.add('pipeline.completed', {
    pipeline_id: pipelineRun._id.toString(),
    event_id: event_id,
    repository_id: repository_id,
    commit_sha: commitSha,
    branch: branch,
    status: pipelineRun.status,
    duration_ms: pipelineRun.durationMs
  });
  
  if (ciResult.status !== 'success') {
      throw new Error(ciResult.error || 'Pipeline failed');
  }
  
  return { status: ciResult.status };
}, { 
  connection: redisConnection,
  concurrency: 2 // Limit concurrency for CI jobs
});

pipelineWorker.on('completed', job => {
  console.log(`[Pipeline Worker] Job ${job.id} has completed!`);
});

pipelineWorker.on('failed', (job, err) => {
  console.error(`[Pipeline Worker] Job ${job.id} has failed with ${err.message}`);
});

module.exports = pipelineWorker;
