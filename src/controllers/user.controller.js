
import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import { isValidObjectId } from "mongoose";

const generateAccessAndRefreshTokens = async(userId) =>
{
    try {
        const user=await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken= user.generateRefreshToken()
        
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}
        // accessToken user ko de dete h
        // refresh token ko database me bhi save kr k rkhte h 
    } catch (error) {
        throw new ApiError(500, "something went wrong while generating refresh and access token")
    }
}


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
try{
    const {fullName, email, username, password } =req.body   // req.body express ne dia h  
    // console.log("email: ", email);
    
    // if (fullName === ""){
    //     throw new ApiError(400, "fullname is required")
    // }

// check all together  // Validate input fields
    if (
        [fullName, email, username, password].some((field) => !field || field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
 } 
    
    const existedUser = await User.findOne({
        $or: [{ username }, {email}]
    })
    
    if(existedUser){
        throw new ApiError (409, "User with email or username already exists")
    }

    // console.log(req.files)
    // console.log(req.body)
    // req.body me sare data aata but also hm lof route k andr ek middle ware addkiye h toh middleware also give some access its add some access in req field like req.files 
    
    const avatarLocalPath = req.files?.avatar[0]?.path; 
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }
    
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
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
        email,
        password,
        username: username.toLowerCase()
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"something went wrong while registering a user" )
    }
    
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    );
}catch(error){
    console.error(error);
    res.status(error.statusCode || 500).json(new ApiResponse(error.statusCode || 500, null, error.message || "Internal Server Error"));

}
    // res.status(200).json({
    //     message: "okay"
    // })
})

const loginUser = asyncHandler(async (req,res)=>{
    //
    // req body -> data 
    // username or email login
    // find the user
    // validate the password check
    // access and refresh token generate
    // send in cookie
    // response successfully login 

    const {email, username, password} = req.body 

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    
    // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
        
    // }

    const user= await User.findOne({
        $or:[{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exist")
    }

    // const isPasswordValid = await user.isPasswordCorrect(password)
    // const isPasswordValid = user ? await user.isPasswordCorrect(password) : false;
    // console.log(user);
    const isPasswordValid = await user.isPasswordCorrect(password)
    // console.log(isPasswordValid);
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
     
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly: true,
        secure: true 
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken 
            },
            "User logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req, res)=>{
    //
    // req.user._id
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
            {
                new: true
            }  
    )

    const options={
        httpOnly: true,
        secure: true 
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, {}, "User Logged out"))
})


const refreshAccessToken = asyncHandler(async(req, res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken)
    {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken= jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user= await User.findById(decodedToken?.id)
    
        if(!user)
        {
            throw new ApiError(401, "Invalid refress token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken)
        {
            throw new ApiError(401, "refress token is expired or used")
        }
    
        const options={
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken}= await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
            200,
            {accessToken, refreshToken: newRefreshToken},
            "Access token refreshed"
        )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

// })

})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}