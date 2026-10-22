if (process.env.NODE_ENV != "production") {
require('dotenv').config()
}

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const port = 8080;
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const ExpressError = require('./utils/ExpressError.js');
const session = require('express-session');
const MongoStore = require("connect-mongo");
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user.js');

const listingRouter = require("./routes/listing.js");
const reviewRouter = require('./routes/review.js');
const userRouter = require('./routes/user.js');
const searchRouter = require('./routes/search.js');

// Fallback to local MongoDB if ATLASDB_URL is not set
const dbUrl = process.env.ATLASDB_URL || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/StayBooking';
const secret = process.env.SECRET || 'devSessionSecretKeyStayBooking';

main().then(() => {
  console.log("Database connected successfully");
}).catch(err => {
  console.error("Database connection error:", err);
});

async function main() {
  await mongoose.connect(dbUrl);
  console.log("Connected to MongoDB");
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);


const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: secret,
  },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
  console.log("Error in mongo session store", err);
});

const sessionOptions = {
  store,
  secret: secret,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}; 

app.get('/', (async (req, res) => {
  res.redirect("/listings");
}));



app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currUser = req.user;
  next();
});

// Search route must be mounted BEFORE /listings so /listings/:id doesn't intercept it
app.use("/listings/search", searchRouter);
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);



app.use((req, res, next) => {
  next(new ExpressError(404, 'Page Not Found!'));
});

// Middleware for handling 404 errors
app.use((err, req, res, next) => {
  let { status = 500, message = "Something went wrong" } = err;
  res.status(status).render("error.ejs", { message })
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}/listings`);
});