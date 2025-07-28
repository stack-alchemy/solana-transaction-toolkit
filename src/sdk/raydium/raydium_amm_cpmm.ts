import { Connection, PublicKey } from "@solana/web3.js";
import {
  Liquidity,
  LiquidityPoolKeys,
  LIQUIDITY_STATE_LAYOUT_V4,
  MARKET_STATE_LAYOUT_V3,
  SPL_MINT_LAYOUT,
  SPL_ACCOUNT_LAYOUT,
  ApiPoolInfoV4,
  Market,
  jsonInfo2PoolKeys,
  Percent,
  Token,
  TokenAmount,
  TxVersion,
  TokenAccount,
  LOOKUP_TABLE_CACHE,
} from "@raydium-io/raydium-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { solanaWeb3Service } from "../solana/solanaWeb3Service";
import { SLIPPAGE_TOLERANCE } from "../../config/constant";

const formatPoolKeys = async (
  connection: Connection,
  poolId: string
): Promise<ApiPoolInfoV4> => {
  try {
    const account = await connection.getAccountInfo(new PublicKey(poolId));
    if (!account) {
      throw new Error(`Pool account not found for ID: ${poolId}`);
    }

    const accountInfo = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data);
    const [marketAccount, lpMintAccount] = await Promise.all([
      connection.getAccountInfo(accountInfo.marketId),
      connection.getAccountInfo(accountInfo.lpMint),
    ]);

    if (!marketAccount || !lpMintAccount) {
      throw new Error(
        `Market or LP Mint account not found for pool ID: ${poolId}`
      );
    }

    const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);
    const lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data);

    const result: ApiPoolInfoV4 = {
      id: poolId,
      baseMint: accountInfo.baseMint.toString(),
      quoteMint: accountInfo.quoteMint.toString(),
      lpMint: accountInfo.lpMint.toString(),
      baseDecimals: accountInfo.baseDecimal.toNumber(),
      quoteDecimals: accountInfo.quoteDecimal.toNumber(),
      lpDecimals: lpMintInfo.decimals,
      version: 4,
      programId: account.owner.toString(),
      authority: Liquidity.getAssociatedAuthority({
        programId: account.owner,
      }).publicKey.toString(),
      openOrders: accountInfo.openOrders.toString(),
      targetOrders: accountInfo.targetOrders.toString(),
      baseVault: accountInfo.baseVault.toString(),
      quoteVault: accountInfo.quoteVault.toString(),
      withdrawQueue: accountInfo.withdrawQueue.toString(),
      lpVault: accountInfo.lpVault.toString(),
      marketVersion: 3,
      marketProgramId: accountInfo.marketProgramId.toString(),
      marketId: accountInfo.marketId.toString(),
      marketAuthority: Market.getAssociatedAuthority({
        programId: accountInfo.marketProgramId,
        marketId: accountInfo.marketId,
      }).publicKey.toString(),
      marketBaseVault: marketInfo.baseVault.toString(),
      marketQuoteVault: marketInfo.quoteVault.toString(),
      marketBids: marketInfo.bids.toString(),
      marketAsks: marketInfo.asks.toString(),
      marketEventQueue: marketInfo.eventQueue.toString(),
      lookupTableAccount: PublicKey.default.toString(),
    };

    return result;
  } catch (error: any) {
    throw new Error(
      `Error formatting pool keys for pool ID: ${poolId}. ${error.message}`
    );
  }
};

const getWalletTokenAccounts = async (
  connection: Connection,
  wallet: PublicKey
): Promise<TokenAccount[]> => {
  try {
    const walletTokenAccount = await connection.getTokenAccountsByOwner(
      wallet,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );
    return walletTokenAccount.value.map((i) => ({
      pubkey: i.pubkey,
      programId: i.account.owner,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
    }));
  } catch (error: any) {
    throw new Error(
      `Error fetching token accounts for wallet ${wallet.toBase58()}: ${
        error.message
      }`
    );
  }
};

export const getRaydiumAMMSwapInstructions = async (
  poolId: string,
  owner: string,
  inputMint: string,
  outputMint: string,
  amount: number
) => {
  try {
    const connection = solanaWeb3Service.connection;
    const formattePoolKeys = await formatPoolKeys(connection, poolId);
    const poolKeys = jsonInfo2PoolKeys(formattePoolKeys) as LiquidityPoolKeys;

    const poolInfo = await Liquidity.fetchInfo({
      connection,
      poolKeys,
    });

    const ownerKey = new PublicKey(owner);
    const inputMintKey = new PublicKey(inputMint);
    const outputMintKey = new PublicKey(outputMint);
    const slippage = new Percent(SLIPPAGE_TOLERANCE, 100);

    const [inputTokenDecimals, outputTokenDecimals, walletTokenAccounts] =
      await Promise.all([
        solanaWeb3Service.getTokenDecimals(inputMint),
        solanaWeb3Service.getTokenDecimals(outputMint),
        getWalletTokenAccounts(connection, ownerKey),
      ]);
    const inputToken = new Token(
      TOKEN_PROGRAM_ID,
      inputMintKey,
      inputTokenDecimals
    );
    const outputToken = new Token(
      TOKEN_PROGRAM_ID,
      outputMintKey,
      outputTokenDecimals
    );
    const inputTokenAmount = new TokenAmount(inputToken, amount.toString());

    const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
      poolKeys,
      poolInfo,
      amountIn: inputTokenAmount,
      currencyOut: outputToken,
      slippage,
    });

    // const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
    //   connection,
    //   poolKeys,
    //   userKeys: {
    //     tokenAccounts: walletTokenAccounts,
    //     owner: ownerKey,
    //   },
    //   amountIn: inputTokenAmount,
    //   amountOut: minAmountOut,
    //   fixedSide: "in",
    //   makeTxVersion: TxVersion.V0,
    // });

    const inputTokenAccount = walletTokenAccounts.find(
      (account) => account.accountInfo.mint.toString() === inputMint
    )!;
    const outputTokenAccount = walletTokenAccounts.find(
      (account) => account.accountInfo.mint.toString() === outputMint
    )!;

    const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
      {
        poolKeys,
        userKeys: {
          tokenAccountIn: inputTokenAccount?.pubkey,
          tokenAccountOut: outputTokenAccount?.pubkey,
          owner: ownerKey,
        },
        amountIn: inputTokenAmount.raw,
        minAmountOut: 0,
      },
      poolKeys.version
    );

    return { innerTransaction, amountOut };
  } catch (error: any) {
    throw new Error(
      `Error getting Raydium AMM swap instructions for pool ID ${poolId}: ${error.message}`
    );
  }
};

export const getRaydiumCPMMSwapInstructions = async (
  poolId: string,
  owner: string,
  inputMint: string,
  outputMint: string,
  amount: number
) => {
  try {
    const connection = solanaWeb3Service.connection;
    const formattePoolKeys = await formatPoolKeys(connection, poolId);
    const poolKeys = jsonInfo2PoolKeys({
      ...formattePoolKeys,
      curveType: 0,
    }) as LiquidityPoolKeys;

    const poolInfo = await Liquidity.fetchInfo({
      connection,
      poolKeys,
    });

    const ownerKey = new PublicKey(owner);
    const inputMintKey = new PublicKey(inputMint);
    const outputMintKey = new PublicKey(outputMint);
    const slippage = new Percent(0, 100);

    const [inputTokenDecimals, outputTokenDecimals, walletTokenAccounts] =
      await Promise.all([
        solanaWeb3Service.getTokenDecimals(inputMint),
        solanaWeb3Service.getTokenDecimals(outputMint),
        getWalletTokenAccounts(connection, ownerKey),
      ]);
    const inputToken = new Token(
      TOKEN_PROGRAM_ID,
      inputMintKey,
      inputTokenDecimals
    );
    const outputToken = new Token(
      TOKEN_PROGRAM_ID,
      outputMintKey,
      outputTokenDecimals
    );
    const inputTokenAmount = new TokenAmount(inputToken, amount.toString());

    const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
      poolKeys,
      poolInfo,
      amountIn: inputTokenAmount,
      currencyOut: outputToken,
      slippage,
    });

    const inputTokenAccount = walletTokenAccounts.find(
      (account) => account.accountInfo.mint.toString() === inputMint
    )!;
    const outputTokenAccount = walletTokenAccounts.find(
      (account) => account.accountInfo.mint.toString() === outputMint
    )!;

    const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
      {
        poolKeys,
        userKeys: {
          tokenAccountIn: inputTokenAccount?.pubkey,
          tokenAccountOut: outputTokenAccount?.pubkey,
          owner: ownerKey,
        },
        amountIn: inputTokenAmount.raw,
        minAmountOut: 0,
      },
      poolKeys.version
    );

    return { innerTransaction, amountOut };
  } catch (error: any) {
    throw new Error(
      `Error getting Raydium CPMM swap instructions for pool ID ${poolId}: ${error.message}`
    );
  }
};
