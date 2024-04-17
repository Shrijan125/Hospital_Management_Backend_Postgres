import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { PrismaClient } from "@prisma/client";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcrypt";
import { uploadOnCloudinary } from "../utils/cloudinary";
const prisma = new PrismaClient();

const verifyJwt = async (accessToken: string) => {
  try {
    const decodedToken = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET!
    ) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(decodedToken._id) },
    });

    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }
    return user.id;
  } catch (error: any) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
};

const generateAccessTokenAndRefreshTokens = async (userId: number) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const accessToken = jwt.sign(
      {
        _id: user?.id,
        email: user?.email,
        username: user?.username,
        profile: user?.profilePhoto,
      },
      process.env.ACCESS_TOKEN_SECRET!,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
      }
    );
    const newrefreshToken = jwt.sign(
      {
        _id: user?.id,
      },
      process.env.REFRESH_TOKEN_SECRET!,
      {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
      }
    );
    await prisma.user.update({
      where: {
        id: user?.id,
      },
      data: {
        refreshToken: newrefreshToken,
      },
    });

    return { accessToken, newrefreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const SignUpUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  if ([email, username, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await prisma.user.findUnique({
    where: { email, username },
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  const encrytedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      profilePhoto: "",
      email,
      password: encrytedPassword,
      username,
    },
  });

  const createdUserId = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      refreshToken: false,
      password: false,
      username: true,
      email: true,
      profilePhoto: true,
      id: true,
    },
  });

  if (!createdUserId) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUserId, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password, username } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await prisma.user.findUnique({ where: { email, username } });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user Credentials");
  }

  const { accessToken, newrefreshToken } =
    await generateAccessTokenAndRefreshTokens(user.id);

  const loggedInUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      refreshToken: false,
      password: false,
      username: true,
      email: true,
      profilePhoto: true,
      id: true,
    },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, newrefreshToken },
        "User logged in successfully."
      )
    );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorised Request");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET!
    ) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decodedToken._id) },
    });
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, newrefreshToken } =
      await generateAccessTokenAndRefreshTokens(user.id);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { accessToken: accessToken, refreshToken: newrefreshToken },
          "Access Token refreshed"
        )
      );
  } catch (error: any) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const token = req.headers["authorization"]?.replace("Bearer ", "");
  if (!token || token === null) {
    throw new ApiError(401, "Unauthorized request");
  }
  const id: number = await verifyJwt(token!);
  const oldpassword: string = oldPassword;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user == null) {
    throw new ApiError(401, "Unauthorized request");
  }
  const isPasswordCorrect = await bcrypt.compare(oldpassword, user.password);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }
  const encrytedPassword = await bcrypt.hash(newPassword, 10);
  const updatedUser = await prisma.user.update({
    where: {
      id: user?.id,
    },
    data: {
      password: encrytedPassword,
    },
  });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const token = req.headers["authorization"]?.replace("Bearer ", "");
  if (!token || token === null) {
    throw new ApiError(401, "Unauthorized request");
  }
  const id: number = await verifyJwt(token!);
  const user = await prisma.user.findUnique({ where: { id } });
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Current User Fetched Successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
  const token = req.headers["authorization"]?.replace("Bearer ", "");
  if (!token || token === null) {
    throw new ApiError(401, "Unauthorized request");
  }
  const id: number = await verifyJwt(token!);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user == null) {
    throw new ApiError(401, "Unauthorized request");
  }

  await prisma.user.update({ where: { id }, data: { refreshToken: "" } });

  return res.status(200).json(new ApiResponse(200, {}, "User Logged Out"));
});

const getDoctors = asyncHandler(async (req, res) => {
    const token = req.headers["authorization"]?.replace("Bearer ", "");
  if (!token || token === null) {
    throw new ApiError(401, "Unauthorized request");
  }
  const id: number = await verifyJwt(token!);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user == null) {
    throw new ApiError(401, "Unauthorized request");
  }

    const getAllDoctors = await prisma.doctor.findMany({select:{name:true, availability:true, department:true,consultationCharge:true}});
    if (!getAllDoctors || getAllDoctors.length === 0) {
      throw new ApiError(404, "No Doctor Found");
    }
    return res
      .status(200)
      .json(
        new ApiResponse(200, getAllDoctors, "Fetched Doctors names successfully")
      );
  });

  const getDepartment = asyncHandler(async (req, res) => {
    const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (!token || token === null) {
      throw new ApiError(401, "Unauthorized request");
    }
    const id: number = await verifyJwt(token!);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user == null) {
      throw new ApiError(401, "Unauthorized request");
    }
    const getAllDepts = await prisma.dept.findMany({select:{name:true}});
    if (!getAllDepts || getAllDepts.length === 0) {
      throw new ApiError(404, "No Department Found");
    }
    return res
      .status(200)
      .json(
        new ApiResponse(200, getAllDepts, "Fetched Department names successfully")
      );
  });

  const updateEmail = asyncHandler(async (req, res) => {
    const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (!token || token === null) {
      throw new ApiError(401, "Unauthorized request");
    }
    const id: number = await verifyJwt(token!);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user == null) {
      throw new ApiError(401, "Unauthorized request");
    }
    const { email } = req.body;
    if (!email) {
      throw new ApiError(400, "Email is required");
    }
  await prisma.user.update({where:{id:user.id},data:{
    email
  },select:{
    password:false,email:true,id:true
  }});

    const { accessToken, newrefreshToken } =
      await generateAccessTokenAndRefreshTokens(user.id);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { accessToken: accessToken, refreshToken: newrefreshToken },
          "Email Updated"
        )
      );
  });

  const updateUserProfile = asyncHandler(async (req, res) => {
     const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (!token || token === null) {
      throw new ApiError(401, "Unauthorized request");
    }
    const id: number = await verifyJwt(token!);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user == null) {
      throw new ApiError(401, "Unauthorized request");
    }
    const { email } = req.body;
    if (!email) {
      throw new ApiError(400, "Email is required");
    }
    const profileLocalPath = req.file?.path;
  
    if (!profileLocalPath) {
      throw new ApiError(400, "Profile file is missing");
    }
  
    const profile = await uploadOnCloudinary(profileLocalPath);
  
    if (profile===null || profile.url) {
      throw new ApiError(400, "Error while uploading on profile");
    }
  
    const updatedUser=await prisma.user.update({where:{id:user.id},data:{profilePhoto:profile.url},select:{password:false,profilePhoto:true,email:true,id:true,refreshToken:true}});
  
    return res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "Profile photo updated succesfully"));
  });

  const getAvailableSlot = asyncHandler(async (req, res) => {
    const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (!token || token === null) {
      throw new ApiError(401, "Unauthorized request");
    }
    const id: number = await verifyJwt(token!);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user == null) {
      throw new ApiError(401, "Unauthorized request");
    }
    const { doctor_id }= req.query;
    const parsedDoctorId = typeof doctor_id === 'string' ? parseInt(doctor_id, 10) : undefined;
    const getslot = await prisma.doctor.findUnique({where:{id:parsedDoctorId},select:{availability:true} });
    if (!getslot || getslot.availability.length===0) {
      throw new ApiError(404, "No Time Slot Found");
    }
    return res
      .status(200)
      .json(new ApiResponse(200, getslot, "Fetched TimeSlots  successfully"));
  });

  const bookAppointment = asyncHandler(async (req, res) => {
    const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (!token || token === null) {
      throw new ApiError(401, "Unauthorized request");
    }
    const id: number = await verifyJwt(token!);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user == null) {
      throw new ApiError(401, "Unauthorized request");
    }
    const { doctor_id, booked_time, dept_id, index, user_id } = req.body;
    if ([doctor_id, dept_id, user_id].some((field) => field?.trim() === "")) {
      throw new ApiError(400, "All fields are required");
    }
  
    if (!index) {
      throw new ApiError(400, "All fields are required");
    }
  
    if (booked_time == "") {
      throw new ApiError(409, "This time slot has been booked");
    }
  
    const appointment = await prisma.appointment.create({
      data:{doctorID: doctor_id,
      timeSlot: booked_time,
      deptID: dept_id,
      userID:user_id,}
    });
  
    const updatedDoctor = await prisma.doctor.update({
        where: { id: doctor_id },
        data: {
          availability: {
            update: [
              {
                where: { id: index },
                data: { booked: true }
              }
            ]
          }
        }
      });
      
      
    if (!updatedDoctor) {
      throw new ApiError(
        500,
        "Something went wrong while booking the appointment"
      );
    }
  
    const createdAppointment =prisma.appointment.findUnique({where:{id:appointment.id}});
  
    if (!createdAppointment) {
      throw new ApiError(
        500,
        "Something went wrong while booking the appointment"
      );
    }
    return res
      .status(200)
      .json(
        new ApiResponse(200, appointment.id, "Appointment Booked successfully")
      );
  });
export {
  SignUpUser,
  loginUser,
  getDoctors,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  getDepartment,
  updateEmail,
  updateUserProfile,
  getAvailableSlot,
  bookAppointment
};
