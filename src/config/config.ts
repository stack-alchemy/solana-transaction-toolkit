import dotenv from 'dotenv';

dotenv.config();

export const PRIVATE_KEY: string = process.env.PRIVATE_KEY || '';
export const RPC_ENDPOINT: string = process.env.RPC_ENDPOINT || '';