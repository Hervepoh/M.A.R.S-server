import dotenv from 'dotenv';
dotenv.config({ path: '.env' })

export const PORT = process.env.NODE_PORT;
export const NODE_ORIGIN = process.env.NODE_ORIGIN!;
export const NODE_ENV = process.env.NODE_ENV!;

export const SALT_ROUNDS = process.env.SALT_ROUNDS;

export const ACTIVATION_TOKEN_SECRET = process.env.ACTIVATION_TOKEN_SECRET || "";
export const ACTIVATION_TOKEN_EXPIRE = process.env.ACTIVATION_TOKEN_EXPIRE || "";

export const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "";
export const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE || "";

export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "";
export const REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE || "";

export const DATABASE_EXTERNAL_SERVICE_NAME = process.env.DATABASE_EXTERNAL_SERVICE_NAME || "";
export const DATABASE_EXTERNAL_HOSTNAME = process.env.DATABASE_EXTERNAL_HOSTNAME || "";
export const DATABASE_EXTERNAL_PORT= process.env.DATABASE_EXTERNAL_PORT || "";
export const DATABASE_EXTERNAL_USERNAME = process.env.DATABASE_EXTERNAL_USERNAME || "";
export const DATABASE_EXTERNAL_PASSWORD = process.env.DATABASE_EXTERNAL_PASSWORD || "";

export const SCRIPT_GENERATION_BROUILLARD = process.env.SCRIPT_GENERATION_BROUILLARD || "/u02/VAS_APPS/Generate_Brouillards/ExtractBrouillard.groovy";
export const SCRIPT_GENERATION_BROUILLARD_OUTPUT = process.env.SCRIPT_GENERATION_BROUILLARD_OUTPUT || "/u02/VAS_APPS/Generate_Brouillards/BACKUP_DIR/BROUILLARDS/5701473/";

export const REDIS_HOSTNAME = process.env.REDIS_HOSTNAME;
export const REDIS_PORT = process.env.REDIS_PORT;
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
export const REDIS_SESSION_EXPIRE = process.env.REDIS_SESSION_EXPIRE!;

export const FTP_HOST = process.env.FTP_HOST;
export const FTP_USER = process.env.FTP_USER;
export const FTP_PASSWORD = process.env.FTP_PASSWORD;
export const FTP_PORT = parseInt(process.env.FTP_PORT || '21'); 
export const FTP_LOCAL_PATH = process.env.FTP_LOCAL_PATH || "";
export const FTP_BACKUP_PATH = process.env.FTP_BACKUP_PATH || "";
export const FTP_REMOTE_PATH = process.env.FTP_REMOTE_PATH || "";


export const SMTP_SERVICE = process.env.SMTP_SERVICE;
export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = process.env.SMTP_PORT;
export const SMTP_CIPHERS = process.env.SMTP_CIPHERS;
export const SMTP_MAIL = process.env.SMTP_MAIL;
export const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

export const MAIL_DOMAIN = process.env.MAIL_DOMAIN;
export const MAIL_NO_REPLY = process.env.MAIL_NO_REPLY;

export const MMS_WSDL_URL = process.env.MMS_WSDL_URL;
export const MMS_USER = process.env.MMS_USER;
export const MMS_PASSWORD = process.env.MMS_PASSWORD;
export const MMS_DBPROFILE = process.env.MMS_DBPROFILE;