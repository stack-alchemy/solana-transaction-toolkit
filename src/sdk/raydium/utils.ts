import {
  AMM_V4,
  AMM_STABLE,
  CREATE_CPMM_POOL_PROGRAM,
  CLMM_PROGRAM_ID,
} from "@raydium-io/raydium-sdk-v2";
import { PublicKey } from "@solana/web3.js";

// Validate Pools
const VALID_AMM_PROGRAM_ID = new Set([
  AMM_V4.toBase58(),
  AMM_STABLE.toBase58(),
]);

const VALID_CPMM_PROGRAM_ID = new Set([CREATE_CPMM_POOL_PROGRAM.toBase58()]);

const VALID_CLMM_PROGRAM_ID = new Set([CLMM_PROGRAM_ID.toBase58()]);

export const isValidAmm = (id: string) => VALID_AMM_PROGRAM_ID.has(id);
export const isValidCpmm = (id: string) => VALID_CPMM_PROGRAM_ID.has(id);
export const isValidClmm = (id: string) => VALID_CLMM_PROGRAM_ID.has(id);

// PDAs
const OBSERVATION_SEED = Buffer.from("observation", "utf8");

export const getPdaObservationId = (
  programId: PublicKey,
  poolId: PublicKey
): {
  publicKey: PublicKey;
  nonce: number;
} => {
  const [publicKey, nonce] = PublicKey.findProgramAddressSync(
    [OBSERVATION_SEED, poolId.toBuffer()],
    programId
  );
  return { publicKey, nonce };
};
