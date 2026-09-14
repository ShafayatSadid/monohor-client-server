// index.js
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { connectDB } = require("./lib/db");
const categoriesRouter = require("./routes/categories");
const productsRouter = require("./routes/products");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send({ message: "Monohor server running" });
});

// Routes
app.use("/categories", categoriesRouter);
app.use("/products", productsRouter);

// Connect DB, তারপর listen
connectDB()
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

module.exports = app;