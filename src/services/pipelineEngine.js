const PipelineRun = require("../models/PipelineRun");

const triggerPipeline = async (eventDoc) => {
  console.log(`[PIPELINE] Starting pipeline for ${eventDoc.type}`);

  const pipelineRun = await PipelineRun.create({
    eventId: eventDoc._id,
    repositoryId: eventDoc.repositoryId,
    status: "running",
    startedAt: new Date(),
  });

  try {
    // 🔹 Simulated pipeline execution
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // You can simulate failure conditionally if needed
    // if (Math.random() < 0.2) throw new Error("Random failure");

    pipelineRun.status = "success";
    pipelineRun.completedAt = new Date();
    pipelineRun.durationMs =
    pipelineRun.completedAt - pipelineRun.startedAt;

    await pipelineRun.save();

    console.log("[PIPELINE] Pipeline completed successfully");

  } catch (err) {
    pipelineRun.status = "failed";
    pipelineRun.completedAt = new Date();
    pipelineRun.durationMs =
    pipelineRun.completedAt - pipelineRun.startedAt;

    await pipelineRun.save();

    console.error("[PIPELINE] Pipeline failed:", err.message);
  }

  return pipelineRun;
};

module.exports = { triggerPipeline };