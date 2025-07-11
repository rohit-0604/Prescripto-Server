import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './config/mongodb.js'
import connectCloudinary from './config/cloudinary.js'
import adminRouter from './routes/adminRoute.js'
import doctorRouter from './routes/doctorRoute.js'
import userRouter from './routes/userRoute.js'


// App Config
const app = express()
const port = process.env.PORT || 4000
connectDB()
connectCloudinary()

// ✅ CORS Setup connect frontend to backend
const allowedOrigins = [
  'https://prescriptodoctorappointmentapp.netlify.app',
  'https://prescriptoadmindoctorpanel.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// app.options('*', cors()); // Handle preflight requests for all routes

// Middleware
app.use(express.json()) // requests gets passes through this

// Api endpoints
console.log("Mounting /api/admin routes...");
app.use('/api/admin', adminRouter);

console.log("Mounting /api/doctor routes...");
app.use('/api/doctor', doctorRouter);

console.log("Mounting /api/user routes...");
app.use('/api/user', userRouter);

// localhost:4000/api/admin

app.get('/',(req,res)=>{
    res.send("API WORKING")
})

app.listen(port,()=> console.log("Server Started",port))
