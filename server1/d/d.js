require("dotenv").config({
    path: "./e/e.env"
});
const express = require("express");
const cors = require("cors");
const connectDB = require("../a/a");
const routes = require("../c/c");

const app = express();

connectDB();
app.use(cors());
app.use(express.json());
app.use("/api", routes);

app.listen(process.env.PORT, () => {
    console.log("Server running on port", process.env.PORT);
});
