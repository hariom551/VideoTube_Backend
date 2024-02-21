
import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async(req, res) =>{
    // Step 
    // get user details from front-end
    // validation-- not empty
    // check if user already exists: username, email
    // check for images, check for avatar that is compussary
    // upload them to cloudinary, avatar
    // create user object - create entry in db 
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {fullName, email, username, password } =req.body   // req.body express ne dia h  
    console.log("email: ", email);
    
    // if (fullName === ""){
    //     throw new ApiError(400, "fullname is required")
    // }

// check all together
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
 } 
    
    const existedUser = User.findOne({
        $or: [{ username }, {email}]
    })
    
    if(existedUser){
        throw new ApiError (409, "User with email or username already exists")
    }


    // req.body me sare data aata but also hm lof route k andr ek middle ware addkiye h toh middleware also give some access its add some access in req field like req.files 
    
    const avatarLocalPath = req.files?.avatar[0]?.path; 
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    
    // ? use for optionaly check for access available or not
    // avataar ka pass size, type yeh sb hoga ..[0] used for need 1st index of file 
   
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user= await User.create({
        fullName,
        avatar:avatar.url,
        coverImage: coverImage?.url || "",
        // becoz cover image not requires
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"something went wrong while registering a user" )
    }
    
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
   
    // res.status(200).json({
    //     message: "okay"
    // })
})



export {
    registerUser,
}