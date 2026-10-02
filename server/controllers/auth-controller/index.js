const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
  const { userName, userEmail, password } = req.body || {};

  if (!userName || !userEmail || !password) {
    return res.status(400).json({
      success: false,
      message: "User name, email, and password are required",
    });
  }

  const cleanedUserName = userName.trim();
  const cleanedUserEmail = userEmail.trim().toLowerCase();

  const existingUser = await User.findOne({
    $or: [{ userEmail: cleanedUserEmail }, { userName: cleanedUserName }],
  });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message:
        "An account with this email or username already exists. Sign in or use different details.",
    });
  }

  const hashPassword = await bcrypt.hash(password, 10);
  const newUser = new User({
    userName: cleanedUserName,
    userEmail: cleanedUserEmail,
    role: "user",
    password: hashPassword,
  });

  await newUser.save();

  return res.status(201).json({
    success: true,
    message: "User registered successfully!",
  });
};

const loginUser = async (req, res) => {
  const { userEmail, password } = req.body;

  const checkUser = await User.findOne({ userEmail });

  if (!checkUser || !(await bcrypt.compare(password, checkUser.password))) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  const accessToken = jwt.sign(
    {
      _id: checkUser._id,
      userName: checkUser.userName,
      userEmail: checkUser.userEmail,
      role: checkUser.role,
    },
    "JWT_SECRET",
    { expiresIn: "120m" }
  );

  res.status(200).json({
    success: true,
    message: "Logged in successfully",
    data: {
      accessToken,
      user: {
        _id: checkUser._id,
        userName: checkUser.userName,
        userEmail: checkUser.userEmail,
        role: checkUser.role,
      },
    },
  });
};

module.exports = { registerUser, loginUser };
