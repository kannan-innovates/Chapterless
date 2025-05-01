const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const session = require("express-session");
const connectDB = require("./config/db");
const userRouter = require("./routes/userRoutes/userRouter");
const adminRoute = require("./routes/adminRoutes/adminRoutes")
const passport = require("./config/passport");
const methodOverride = require('method-override');


const userMiddleware = require("./middlewares/userMiddleware")


connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    },
  })
);
app.use((req, res, next) => {
  // Make the user available to all templates
  res.locals.isAuthenticated = !!req.session.user_id;
  res.locals.user = req.session.user_id ? { id: req.session.user_id } : null;
  next();
});


app.use(passport.initialize());
app.use(passport.session());

app.use(userMiddleware);

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride('_method'));

app.use("/", userRouter);
app.use("/admin",adminRoute)

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

module.exports.app;
