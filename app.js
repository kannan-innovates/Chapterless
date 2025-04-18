const express  = require("express");
const app = express();
const env = require("dotenv").config();
const connectDB = require("./config/db")


connectDB()

app.listen(process.env.PORT,() =>{
     console.log(`🚀 Server running at http://localhost:${process.env.PORT}`);
      
})


module.exports.app;