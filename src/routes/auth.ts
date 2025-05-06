import { Router } from "express";

import { errorHandler } from "../core/error-handler";
import authMiddleware from "../middlewares/auth";
import { signup, signin, me, activate, signout, updateAccessToken } from "../controllers/auth";


const authRoutes: Router = Router();

authRoutes.post('/register', errorHandler(signup));
authRoutes.post('/activate', errorHandler(activate));
authRoutes.post('/login', errorHandler(signin));
authRoutes.get('/me', [authMiddleware], errorHandler(me));
authRoutes.get('/refresh', errorHandler(updateAccessToken));
authRoutes.post('/logout',  [authMiddleware] , errorHandler(signout));
//authRoutes.get('/social', [authMiddleware], errorHandler(socialSignin));

export default authRoutes;