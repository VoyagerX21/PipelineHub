const PipelineRun = require("../models/PipelineRun");

const pipelineQueue = require('../queues/pipelineQueue');

const triggerPipeline = async (eventDoc, payload) => {
  console.log(`[PIPELINE] Queueing pipeline for ${eventDoc.type}`);

  const pipelineRun = await PipelineRun.create({
    eventId: eventDoc._id,
    repositoryId: eventDoc.repositoryId,
    status: "queued",
  });

  try {
    await pipelineQueue.add('execute-pipeline', {
      pipeline_id: pipelineRun._id.toString(),
      event_id: eventDoc._id.toString(),
      repository_id: eventDoc.repositoryId.toString(),
      provider: eventDoc.provider,
      branch: eventDoc.branch,
      payload: payload
    }, {
      jobId: `pipeline-${eventDoc._id.toString()}` // Idempotency
    });

    console.log(`[PIPELINE] Pipeline job queued successfully: ${pipelineRun._id}`);
  } catch (err) {
    pipelineRun.status = "failed";
    pipelineRun.failureReason = err.message;
    await pipelineRun.save();
    console.error("[PIPELINE] Failed to queue pipeline:", err.message);
  }

  return pipelineRun;
};

module.exports = { triggerPipeline };