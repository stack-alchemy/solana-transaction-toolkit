import dotenv from "dotenv";

dotenv.config({ path: ".env" });

export const PRIVATE_KEY: string = process.env.PRIVATE_KEY || "";
export const RPC_ENDPOINT: string = process.env.RPC_ENDPOINT || "";
export const WS_ENDPOINT: string = process.env.WS_ENDPOINT || "";
export const TARGET_WALLET: string = process.env.TARGET_WALLET || "";