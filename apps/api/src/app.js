const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "navo-api",
    timestamp: Date.now(),
    version: "v1",
  });
});

const intentsRouter = require("./routes/intents");
const workRouter = require("./routes/work");
const aiRouter = require("./routes/ai");
const plansRouter = require("./routes/plans");

app.use("/api/intents", intentsRouter);
app.use("/api/work", workRouter);
app.use("/api/ai", aiRouter);
app.use("/api/plans", plansRouter);

module.exports = app;
