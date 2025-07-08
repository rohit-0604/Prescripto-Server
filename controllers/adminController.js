import validator from 'validator'
import bcrypt from 'bcrypt'
import { v2 as cloudinary } from 'cloudinary'
import doctorModel from '../models/doctorModel.js'
import jwt from 'jsonwebtoken'
import appointmentModel from '../models/appointmentModel.js'
import userModel from '../models/userModel.js'

// API for ADDING DOCTOR
const addDoctor = async (req, res) => {
  try {
    const { name, email, password, speciality, degree, experience, about, fees, address } = req.body
    const imageFile = req.file

    // Validate required fields
    if (!name || !email || !password || !speciality || !degree || !experience || !about || !fees || !address) {
      return res.status(400).json({ success: false, message: "Missing required details" })
    }

    // Validate email format
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email" })
    }

    // Check if doctor already exists
    const existingDoctor = await doctorModel.findOne({ email })
    if (existingDoctor) {
      return res.status(400).json({ success: false, message: "Doctor already exists with this email" })
    }

    // Validate password strength
    if (!validator.isStrongPassword(password, { minLength: 8, minNumbers: 1, minSymbols: 1, minLowercase: 1, minUppercase: 1 })) {
      return res.status(400).json({ success: false, message: "Please enter a stronger password (min 8 chars, include numbers & symbols)" })
    }

    // Check for uploaded image
    if (!imageFile) {
      return res.status(400).json({ success: false, message: "Doctor profile image is required" })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Upload image to Cloudinary
    const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" })
    const imageUrl = imageUpload.secure_url

    // Parse address safely
    let parsedAddress
    try {
      parsedAddress = JSON.parse(address)
    } catch (err) {
      return res.status(400).json({ success: false, message: "Address format is invalid JSON" })
    }

    // Prepare doctor data
    const doctorData = {
      name,
      email,
      image: imageUrl,
      password: hashedPassword,
      speciality,
      degree,
      experience,
      about,
      fees,
      address: parsedAddress,
      date: Date.now()
    }

    // Save doctor
    const newDoctor = new doctorModel(doctorData)
    await newDoctor.save()

    return res.status(201).json({ success: true, message: "Doctor added successfully" })
  } catch (error) {
    console.error("Error adding doctor:", error)
    return res.status(500).json({ success: false, message: "Server error: " + error.message })
  }
}

// API for Admin Login
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '2h' })
      return res.json({ success: true, token })
    } else {
      return res.status(401).json({ success: false, message: "Invalid credentials" })
    }
  } catch (error) {
    console.error("Admin login error:", error)
    return res.status(500).json({ success: false, message: "Server error: " + error.message })
  }
}

// API to get all Doctors List for Admin Panel
const allDoctors = async (req,res) => {

  try {

    const doctors = await doctorModel.find({}).select('-password')
    res.json({success: true,doctors})
    
  } catch (error) {
    console.error(error)
    return res.json({ success: false, message:error.message })
  }
}

// API to get all appointments list
const appointmentsAdmin = async (req,res) => {
  try {

    const appointments = await appointmentModel.find({})
    res.json({success:true,appointments})
    
  } catch (error) {
    console.error(error)
    return res.json({ success: false, message:error.message })
  }
}


// API to get total patients count
const patientsCount = async (req, res) => {
  try {
    const count = await userModel.countDocuments({})
    return res.json({ success: true, count })
  } catch (error) {
    console.error("Error fetching patients count:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}


export { addDoctor, loginAdmin, allDoctors, appointmentsAdmin, patientsCount }
