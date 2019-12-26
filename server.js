const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const shortid = require("shortid");

const cors = require("cors");

const mongoose = require("mongoose");
const Schema = mongoose.Schema;
mongoose.connect(process.env.MLAB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
});

const UserSchema = new Schema({
  _id: { type: String, default: shortid.generate },
  username: { type: String, required: true, unique: true },
  exercises: [
    {
      description: { type: String, required: true },
      duration: { type: Number, required: true },
      timestamp: { type: Date, default: Date.now, select: false },
      date: { type: String, required: true },
      _id: { type: Number }
    }
  ]
});

const User = mongoose.model("user", UserSchema);

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.get("/api/exercise/users", (req, res) => {
  User.find((err, users) => {
    if (err) {
      res.send(err.message);
    } else {
      res.json(users);
    }
  });
});

app.get("/api/exercise/log", async (req, res) => {
  const { userId, from, to, limit } = req.query;
  if (userId) {
    const user = await User.findOne({ _id: userId }).lean();
    // console.log(user)
    user.exercises = user.exercises.filter(exercise => {
      if (from && new Date(from) > new Date(exercise.date)) {
        return false;
      }
      if (to && new Date(to) < new Date(exercise.date)) {
        return false;
      }
      return true;
    });
    if (limit && !isNaN(+limit)) {
      user.exercises = user.exercises.slice(0, +limit);
    }
    user.count = user.exercises.length;
    res.json(user);
  } else {
    res.send("unknow userid");
  }
});

app.post("/api/exercise/new-user", (req, res) => {
  const { username } = req.body;
  if (username) {
    findUsername(username)
      .then(user => {
        res.send("username already exists");
      })
      .catch(e => {
        const user = new User({ username });
        user.save((err, user) => {
          if (err) {
            res.json(err);
          } else {
            res.json({ username: user.username, _id: user._id });
          }
        });
      });
  } else {
    res.send("enter username");
  }
});

const findUsername = async username => {
  try {
    const user = await User.findOne({ username });
    if (user) {
      return Promise.resolve(user);
    }
  } catch (e) {}
  return Promise.reject({});
};

app.post("/api/exercise/add", (req, res) => {
  let { userId, description, duration, date } = req.body;
  if (!date) {
    date = new Date();
    date =
      date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  }
  date = new Date(date);
  User.findOneAndUpdate(
    { _id: userId },
    {
      $push: {
        exercises: {
          description,
          duration,
          date: date.toDateString(),
          timestamp: date
        }
      }
    },
    { new: true },
    (err, user) => {
      if (err) {
        res.send(err.message);
      } else if (!user) {
        res.send("userId does not exist");
      } else {
        res.json({
          username: user.username,
          _id: user._id,
          description,
          duration,
          date: date.toDateString()
        });
      }
    }
  );
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
