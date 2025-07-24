import { PRIVATE_KEY } from "./src/config/config";
import { solanaWeb3Service } from "./src/sdk/solana/solanaWeb3Service";
import { transactionAnalyzer } from "./src/sdk/solana/solanaTransactionAnalyzer";
import { logger } from "./src/logger/logger";


(async () => {
    const transaction = await solanaWeb3Service.getTransaction("2CXRpRGCRLExNxxVE3qRmGNYqLpSxrsoEecjGVN7syofPBpvm3MJbfQ56cQw4B2ikeieg4j9pJ48pekHLBBqsHy2");
    const swapInfos = await transactionAnalyzer(transaction)
    console.log(swapInfos);
})()
