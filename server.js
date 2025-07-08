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

// Middleware
app.use(express.json()) // requests gets passes through this
app.use(cors())  // connect frontend to backend

// Api endpoints
app.use('/api/admin',adminRouter)
app.use('/api/doctor',doctorRouter)
app.use('/api/user',userRouter)
// localhost:4000/api/admin

app.get('/',(req,res)=>{
    res.send("API WORKING")
})

app.listen(port,()=> console.log("Server Started",port))