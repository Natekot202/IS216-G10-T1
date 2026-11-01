import bcrypt from 'bcrypt'
import User from '../models/UserModel.js'
import { passwordProblems } from '../utils/passwordRules.js';

export const postSignup = async (req, res) => {
  try {
    const { username, email, password, confirmPassword, role } = req.body;

    if (!username || !email || !password || !confirmPassword || !role) {
      return res.status(400).json({ errors: ["Please fill in all fields."] });
    }

    const errors = []
    const cleanUsername = String(username).trim()
    const cleanEmail = String(email).trim().toLowerCase()
    const pwd = String(password)

    if (!['owner', 'sitter'].includes(role)) {
      errors.push('Please choose a valid role.')
    }
    if (!cleanUsername || /[@\s]/.test(cleanUsername)) {
      errors.push("Username can't contain @ or spaces.")
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.push('Must be a valid email.')
    }
    if (await User.getUserByEmail(cleanEmail)) {
      errors.push('Email is already registered.')
    }
    if (cleanUsername && await User.getUserByUsername(cleanUsername)) {
      errors.push('Username is already taken.')
    }
    if (pwd !== String(confirmPassword)) {
      errors.push('Passwords do not match.')
    }
    errors.push(...passwordProblems(pwd))

    if (errors.length > 0) {
      return res.status(400).json({ errors })
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username: username.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role
    });

    req.session.userId = newUser._id;
    req.session.username = newUser.username;
    req.session.role = newUser.role;

    return res.status(201).json({ id: newUser._id, username: newUser.username, role: newUser.role });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ errors: ["Something went wrong during signup."] });
  }
};

export const postLogin = async (req, res) => {
  try {
    const { emailOrUser, password } = req.body;

    if (!emailOrUser || !password) {
      return res.status(400).json({ message: "Please fill in both boxes." });
    }

    const input = emailOrUser.trim();
    const user = input.includes("@")
      ? await User.getUserByEmail(input.toLowerCase())
      : await User.getUserByUsername(input);

    const isMatch = user && (await bcrypt.compare(password, user.password));
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid login details." });
    }

    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;

    return res.json({ id: user._id, username: user.username, role: user.role });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong during login." });
  }
};

export const me = async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not logged in" });
    }
  const user = await User.findById(req.session.userId).select('-password +ownerProfile.address +ownerProfile.instructions +sitterProfile.address')  
  // res.json({ id: user._id, username: user.username, role: user.role, bio: user.bio });
  // if (!user){
  //   return res.status(401).json({ message: "Not logged in" });
  // }
  res.json(user); // to return all
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Please fill in both passwords.' })
  }

  const user = await User.findById(req.session.userId).select('+password')
  if (!user) {
    return res.status(401).json({ message: 'Please log in again.' })
  }

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(400).json({ message: 'Your current password is incorrect.' })
  }
  if (await bcrypt.compare(newPassword, user.password)) {
    return res.status(400).json({ message: 'Your new password must be different from the current one.' })
  }

  const problems = passwordProblems(newPassword)
  if (problems.length > 0) {
    return res.status(400).json({ message: problems[0], errors: problems })
  }

  const hash = await bcrypt.hash(newPassword, 10)
  await User.updateOne({ _id: user._id }, { password: hash })
  res.json({ message: 'Password updated.' })
}

export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Error logging out." });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
};