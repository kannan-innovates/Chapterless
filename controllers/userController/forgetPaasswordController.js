const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");

const getForgotPassword = async (req,res) => {
     try{
          res.render("forgotPassword")
     }catch(error){
          console.log('Error in getting getForgotPassword',err)
     }
}

const postForgotPassword = async (req,res) => {
     try{
          const {email} = req.body;

          const user = await
     }catch(error){

     }
}