// server.js or index.js

//libraries
import express from 'express'; 
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

//connections
dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

// ✅ Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/biddingPortal');
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error);
    process.exit(1);
  }
};
connectDB();

// ✅ Define Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  gstin: { type: String, required: true, unique: true },
});
const User = mongoose.model('User', userSchema);

const bidSchema = new mongoose.Schema({
  email: String,
  username: String,
  amount: Number,
  hoursPerDay: Number,
  date: String,
  timestamp: { type: Date, default: Date.now },
});
const Bid = mongoose.model('Bid', bidSchema);

const allocationSchema = new mongoose.Schema({
  date: String,
  allocated: [
    {
      email: String,
      username: String,
      amount: Number,
      hoursPerDay: Number,
      timestamp: Date,
    },
  ],
  unallocated: [
    {
      email: String,
      username: String,
      amount: Number,
      hoursPerDay: Number,
      timestamp: Date,
    },
  ],
  createdAt: { type: Date, default: Date.now },
});
const Allocation = mongoose.model('Allocation', allocationSchema);

// ✅ Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

// ✅ Signup
app.post('/signup', async (req, res) => {
  try {
    const { email, username, password, mobile, gstin } = req.body;
    if (!email || !username || !password || !mobile || !gstin)
      return res.status(400).json({ error: 'All fields are required' });

    if (await User.findOne({ email })) return res.status(400).json({ error: 'Email already exists' });
    if (await User.findOne({ mobile })) return res.status(400).json({ error: 'Mobile number already exists' });
    if (await User.findOne({ gstin })) return res.status(400).json({ error: 'GSTIN already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, username, password: hashedPassword, mobile, gstin });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Signup failed', details: error.message });
  }
});

// ✅ Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { email: user.email, username: user.username },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '1h' }
    );

    res.status(200).json({ message: 'Login successful', token, email: user.email, username: user.username });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// ✅ Place Bid
app.post('/bid', authenticate, async (req, res) => {
  try {
    const { amount, hoursPerDay, date } = req.body;
    const { email, username } = req.user;

    if (!amount || !hoursPerDay || !date)
      return res.status(400).json({ error: 'Missing bid details' });

    if (amount < 5000)
      return res.status(400).json({ error: 'Minimum bid amount is ₹5000' });

    if (hoursPerDay < 1 || hoursPerDay > 10)
      return res.status(400).json({ error: 'Ad hours must be between 1 and 10' });

    const bidCountForDate = await Bid.countDocuments({ date });
    if (bidCountForDate >= 5) {
      return res.status(400).json({ error: '❌ Bidding is closed for this date. Maximum 5 bids reached.' });
    }

    const existingBid = await Bid.findOne({ email, date });
    if (existingBid)
      return res.status(400).json({ error: 'You have already placed a bid for this date!' });

    const bid = new Bid({ email, username, amount, hoursPerDay, date });
    await bid.save();

    res.status(201).json({ message: 'Bid placed successfully', bid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to place bid', details: error.message });
  }
});

// ✅ Get number of bids placed for a date
app.get('/bid-count/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const count = await Bid.countDocuments({ date });
    res.status(200).json({ date, count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bid count', details: error.message });
  }
});

// ✅ Check if user has already bid for a specific date
app.get('/has-bid/:date', authenticate, async (req, res) => {
  try {
    const { email } = req.user;
    const { date } = req.params;

    const existingBid = await Bid.findOne({ email, date });

    if (existingBid) {
      res.status(200).json({ hasBid: true, message: `✅ You have already placed a bid for ${date}` });
    } else {
      res.status(200).json({ hasBid: false, message: `❌ You haven't placed a bid for ${date} yet` });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error checking bid status', details: error.message });
  }
});

// ✅ View User's Bid Status
app.get('/bid-status/:date', authenticate, async (req, res) => {
  try {
    const { date } = req.params;
    const { email } = req.user;
    const userBids = await Bid.find({ email, date }).sort({ amount: -1, timestamp: 1 });
    res.status(200).json({ count: userBids.length, userBids });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bid status', details: error.message });
  }
});

// ✅ Fractional Knapsack Algorithm
function fractionalKnapsack(bids, maxHours) {
  const sorted = [...bids].sort((a, b) => (b.amount / b.hoursPerDay) - (a.amount / a.hoursPerDay));
  const allocated = [];
  let remaining = maxHours;

  for (let bid of sorted) {
    if (remaining <= 0) break;
    if (bid.hoursPerDay <= remaining) {
      allocated.push({ ...bid._doc });
      remaining -= bid.hoursPerDay;
    } else {
      allocated.push({ ...bid._doc, hoursPerDay: remaining, amount: (bid.amount / bid.hoursPerDay) * remaining });
      remaining = 0;
    }
  }

  return allocated;
}

// ✅ Allocate Bids using Fractional Knapsack (8 hours max)
app.get('/allocate/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const bids = await Bid.find({ date }).sort({ timestamp: 1 });
    if (!bids.length) return res.status(404).json({ error: 'No bids for this date' });

    const topBids = fractionalKnapsack(bids, 8);
    const allocatedEmails = topBids.map(b => b.email);

    const allocated = topBids.map(bid => ({
      email: bid.email,
      username: bid.username,
      amount: bid.amount,
      hoursPerDay: bid.hoursPerDay,
      timestamp: bid.timestamp
    }));

    const unallocated = bids
      .filter(bid => !allocatedEmails.includes(bid.email))
      .map(bid => ({
        email: bid.email,
        username: bid.username,
        amount: bid.amount,
        hoursPerDay: bid.hoursPerDay,
        timestamp: bid.timestamp
      }));

    const updated = await Allocation.findOneAndUpdate(
      { date },
      { allocated, unallocated, createdAt: new Date() },
      { upsert: true, new: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Allocation failed', details: error.message });
  }
});

// ✅ Serve Static Files
app.use(express.static("public"));

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => 
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
