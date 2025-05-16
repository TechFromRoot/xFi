//   async botBuyToken(
//     privateKey: string,
//     tokenMint: string,
//     amount: string,
//     userId: string,
//   ) {
//     try {
//       console.log('buy token', privateKey, tokenMint, amount);
//       const inputMint = 'So11111111111111111111111111111111111111112';
//       const outputMint = tokenMint;
//       const inputTokenDetails = await this.getTokenDetails(inputMint);
//       const outputTokenDetails = await this.getTokenDetails(outputMint);

//       const userAccount = Keypair.fromSecretKey(bs58.decode(privateKey));
//       const userAddress = userAccount.publicKey;

//       const { balance } = await this.walletService.getSolBalance(
//         String(userAddress),
//         process.env.SOLANA_RPC,
//       );

//       if (balance < parseFloat(amount) && balance - parseFloat(amount) < 0.01) {
//         // make sure the user has at least 0.01 SOL for transaction fees
//         return 'Insufficient balance.';
//       }

//       const swapResponse = await this.getSwapQuote(
//         inputMint,
//         outputMint,
//         Number(amount) * 10 ** inputTokenDetails.decimals,
//       );
//       console.log('swapResponse', swapResponse);

//       const connection = new Connection(process.env.SOLANA_RPC, {
//         commitment: 'confirmed',
//       });

//       await getOrCreateAssociatedTokenAccount(
//         connection,
//         userAccount,
//         new PublicKey(inputMint),
//         userAddress,
//       );

//       const swapUrl = `${API_URLS.SWAP_HOST}/transaction/swap-base-in`;

//       const { data } = await firstValueFrom(
//         this.httpService.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`),
//       );

//       const txVersion: string = 'V0';

//       const inputAccount = await getOrCreateAssociatedTokenAccount(
//         connection,
//         userAccount,
//         new PublicKey(inputMint),
//         userAddress,
//       );

//       const outputAccount = await getOrCreateAssociatedTokenAccount(
//         connection,
//         userAccount,
//         new PublicKey(outputMint),
//         userAddress,
//       );

//       const swapTrx = await firstValueFrom(
//         this.httpService.post(swapUrl, {
//           computeUnitPriceMicroLamports: String(data.data.default.h),
//           swapResponse,
//           txVersion,
//           wallet: userAddress,
//           wrapSol: true,
//           unwrapSol: false,
//           inputAccount: inputAccount.address.toBase58(),
//           outputAccount: outputAccount.address.toBase58(),
//         }),
//       );

//       // Decode the base64 transaction
//       const txBuffer = Buffer.from(swapTrx.data.data[0].transaction, 'base64');

//       // Deserialize into a VersionedTransaction
//       const transaction = VersionedTransaction.deserialize(txBuffer);

//       // Set recent blockhash and fee payer
//       const { blockhash, lastValidBlockHeight } =
//         await connection.getLatestBlockhash();
//       transaction.message.recentBlockhash = blockhash;

//       // Sign the transaction
//       transaction.sign([userAccount]);

//       // Send the signed transaction
//       const signature = await connection.sendTransaction(transaction, {
//         skipPreflight: false,
//         preflightCommitment: 'confirmed',
//       });

//       // Confirm the transaction
//       const confirmation = await connection.confirmTransaction({
//         signature,
//         blockhash,
//         lastValidBlockHeight,
//       });

//       if (confirmation.value.err) {
//         throw new Error('Transaction failed');
//       }

//       const tokenInPrice: any = await this.fetchSupportedTokenPrice(
//         swapResponse.data.inputMint,
//       );

//       const transactionDetails = new this.transactionModel({
//         userId: userId,
//         TokenInAddress: swapResponse.data.inputMint,
//         TokenInSymbol: inputTokenDetails.symbol,
//         TokenInName: inputTokenDetails.name,
//         TokenInAmount: swapResponse.data.inputAmount,
//         TokenInPrice: tokenInPrice,
//         TokenOutAddress: swapResponse.data.outputMint,
//         TokenOutSymbol: outputTokenDetails.symbol,
//         TokenOutName: outputTokenDetails.name,
//         TokenOutAmount: swapResponse.data.outputAmount,
//         hash: signature,
//       });
//       await transactionDetails.save();

//       return `https://explorer.solana.com/tx/${signature}?cluster=mainnet`;
//     } catch (error: any) {
//       const regex =
//         /^Signature\s([a-zA-Z0-9]{87})\shas\sexpired:\sblock\sheight\sexceeded\.$/;

//       const match = error.message.match(regex);
//       if (match) {
//         const signature = match[1];
//         console.log('Extracted Signature:', signature);
//         return `https://explorer.solana.com/tx/${signature}?cluster=mainnet`;
//       } else {
//         console.error('Error in swapToken:', error);
//         return `Error buying token: ${error.message}`;
//       }
//     }
//   }

//   async botSellToken(
//     privateKey: string,
//     tokenMint: string,
//     amountPercent: string,
//     chatId: number,
//   ) {
//     try {
//       const inputMint = tokenMint;
//       const outputMint = 'So11111111111111111111111111111111111111112';
//       const inputTokenDetails = await this.getTokenDetails(inputMint);
//       const outputTokenDetails = await this.getTokenDetails(outputMint);

//       const userAccount = Keypair.fromSecretKey(bs58.decode(privateKey));
//       const userAddress = userAccount.publicKey;

//       console.log(amountPercent, privateKey);
//       const { balance } = await this.walletService.getSPLTokenBalance(
//         String(userAddress),
//         inputMint,
//         process.env.SOLANA_RPC,
//         Number(inputTokenDetails.decimals),
//       );

//       let amount = (balance * parseFloat(amountPercent)) / 100;
//       console.log('amount', amount);
//       amount = this.truncateTo9Decimals(amount);
//       console.log('amount', amount);

//       if (balance < amount) {
//         return 'Insufficient balance.';
//       }

//       const swapResponse = await this.getSwapQuote(
//         inputMint,
//         outputMint,
//         +Number(amount) * 10 ** inputTokenDetails.decimals,
//       );
//       console.log('swapResponse', swapResponse);

//       const connection = new Connection(process.env.SOLANA_RPC, {
//         commitment: 'confirmed',
//       });

//       const swapUrl = `${API_URLS.SWAP_HOST}/transaction/swap-base-in`;

//       const { data } = await firstValueFrom(
//         this.httpService.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`),
//       );

//       const txVersion: string = 'V0';

//       const inputAccount = await getOrCreateAssociatedTokenAccount(
//         connection,
//         userAccount,
//         new PublicKey(inputMint),
//         userAddress,
//       );

//       const outputAccount = await getOrCreateAssociatedTokenAccount(
//         connection,
//         userAccount,
//         new PublicKey(outputMint),
//         userAddress,
//       );

//       const swapTrx = await firstValueFrom(
//         this.httpService.post(swapUrl, {
//           computeUnitPriceMicroLamports: String(data.data.default.h),
//           swapResponse,
//           txVersion,
//           wallet: userAddress,
//           wrapSol: false,
//           unwrapSol: true,
//           inputAccount: inputAccount.address.toBase58(),
//           outputAccount: outputAccount.address.toBase58(),
//         }),
//       );

//       // Decode the base64 transaction
//       const txBuffer = Buffer.from(swapTrx.data.data[0].transaction, 'base64');

//       // Deserialize into a VersionedTransaction
//       const transaction = VersionedTransaction.deserialize(txBuffer);

//       // Set recent blockhash and fee payer
//       const { blockhash, lastValidBlockHeight } =
//         await connection.getLatestBlockhash();
//       transaction.message.recentBlockhash = blockhash;

//       // Sign the transaction
//       transaction.sign([userAccount]);

//       // Send the signed transaction
//       const signature = await connection.sendTransaction(transaction, {
//         skipPreflight: false,
//         preflightCommitment: 'confirmed',
//       });

//       // Confirm the transaction
//       const confirmation = await connection.confirmTransaction({
//         signature,
//         blockhash,
//         lastValidBlockHeight,
//       });

//       if (confirmation.value.err) {
//         throw new Error('Transaction failed');
//       }

//       const tokenInPrice: any = await this.fetchSupportedTokenPrice(
//         swapResponse.data.inputMint,
//       );

//       const transactionDetails = new this.transactionModel({
//         chatId: chatId,
//         TokenInAddress: swapResponse.data.inputMint,
//         TokenInSymbol: inputTokenDetails.symbol,
//         TokenInName: inputTokenDetails.name,
//         TokenInAmount: swapResponse.data.inputAmount,
//         TokenInPrice: tokenInPrice,
//         TokenOutAddress: swapResponse.data.outputMint,
//         TokenOutSymbol: outputTokenDetails.symbol,
//         TokenOutName: outputTokenDetails.name,
//         TokenOutAmount: swapResponse.data.outputAmount,
//         hash: signature,
//       });
//       await transactionDetails.save();

//       return `https://explorer.solana.com/tx/${signature}?cluster=mainnet`;
//     } catch (error: any) {
//       const regex =
//         /^Signature\s([a-zA-Z0-9]{87})\shas\sexpired:\sblock\sheight\sexceeded\.$/;

//       const match = error.message.match(regex);
//       if (match) {
//         const signature = match[1];
//         console.log('Extracted Signature:', signature);
//         return `https://explorer.solana.com/tx/${signature}?cluster=mainnet`;
//       } else {
//         console.error('Error in swapToken:', error);
//         return `Error selling token: ${error.message}`;
//       }
//     }
//   }
