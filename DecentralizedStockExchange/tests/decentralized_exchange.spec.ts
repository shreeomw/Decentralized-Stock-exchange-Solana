import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { DecentralizedExchange } from "../target/types/decentralized_exchange";
import * as assert from "assert";

describe("decentralized_exchange", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.DecentralizedExchange as Program<DecentralizedExchange>;
  const wallet = provider.wallet;

  // Define keypairs and PDA for the decentralized exchange system
  const user = anchor.web3.Keypair.generate();
  let decentralizedExchangeSystemPda: PublicKey;
  let bump: number;

  let stockAccountPda: PublicKey;
  let bumpStock: number;

  let holderAccountPda: PublicKey;
  let bumpHolder: number;

  const totalSupply = 1_000_000;
  const ipoBuyAmount = new anchor.BN(1000); // Amount of stocks to buy

  let sellAccountPda: PublicKey;
  let bumpSell: number;

  let buyAccountPda: PublicKey;
  let bumpBuy: number;

  let stockAccount: PublicKey;
  let holderAccount: Keypair;
  let sellAccount: Keypair;
  let buyAccount: Keypair;

  let sellerAccount: PublicKey;
  let buyerAccount: PublicKey;

  before(async () => {
    // Create accounts needed for the test.
    holderAccount = Keypair.generate();
    sellAccount = Keypair.generate();
    buyAccount = Keypair.generate();

    const airdropSignature = await provider.connection.requestAirdrop(
      wallet.publicKey,
      anchor.web3.LAMPORTS_PER_SOL * 2 // 2 SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    // Derive the PDA for the decentralized exchange system account
    [decentralizedExchangeSystemPda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("System Account")],
      program.programId
    );

    const [_stockAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("Stock Account"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
    stockAccount = _stockAccount;

    // Derive the PDA for the stock account
    [stockAccountPda, bumpStock] = PublicKey.findProgramAddressSync(
      [Buffer.from("Stock Account"), stockAccount.toBuffer()],
      program.programId
    );

    // Derive PDA for the sell account
    [sellAccountPda, bumpSell] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("Sell Account"),
        stockAccountPda.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Derive PDA for the buy account
    [buyAccountPda, bumpBuy] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("Buy Account"),
        stockAccountPda.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [_sellerAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [stockAccount.toBuffer(), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
    sellerAccount = _sellerAccount;

    const [_buyerAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [stockAccount.toBuffer(), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
    buyerAccount = _buyerAccount;

    console.log("Initialized accounts and PDAs:");
    console.log("Decentralized Exchange System PDA:", decentralizedExchangeSystemPda.toString());
    console.log("Stock Account PDA:", stockAccountPda.toString());
    console.log("Sell Account PDA:", sellAccountPda.toString());
    console.log("Buy Account PDA:", buyAccountPda.toString());
    console.log("Seller Account:", sellerAccount.toString());
    console.log("Buyer Account:", buyerAccount.toString());
  });

  it("Initializes the decentralized exchange", async () => {
    // Execute the initialize method in the program
    await program.methods
      .initializeDecentralizedExchangeSystem()
      .accounts({
        decentralizedExchangeSystem: decentralizedExchangeSystemPda,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Fetch the decentralized exchange account to verify initialization
    const account = await program.account.systemExchangeAccount.fetch(decentralizedExchangeSystemPda);

    // Log the account state
    console.log("Decentralized Exchange Account State:", account);

    // Example assertion: Verify the owner matches the initializing user
    assert.strictEqual(account.bumpOriginal, bump);
    assert.ok(account.totalStockCompanies === 0);
    assert.ok(account.historicalExchanges.toNumber() === 0);
    assert.ok(account.totalHolders.toNumber() === 0);
    assert.ok(account.totalOffers.toNumber() === 0);
  });

  it("Creates a stock", async () => {
    const name = "TestStock";
    const totalSupply = new anchor.BN(1_000_000);
    const dividends = true;
    const dividendPaymentPeriod = new anchor.BN(30); // 30 days
    const currentTime = (await provider.connection.getBlockTime(await provider.connection.getSlot()))!;
    const dateToGoPublic = currentTime + 7 * 24 * 60 * 60; // 7 days from now
    const priceToGoPublic = new anchor.BN(100);

    console.log("Creating stock with parameters:");
    console.log("Name:", name);
    console.log("Total Supply:", totalSupply.toString());
    console.log("Dividends:", dividends);
    console.log("Dividend Payment Period:", dividendPaymentPeriod.toString());
    console.log("Date to Go Public:", dateToGoPublic);
    console.log("Price to Go Public:", priceToGoPublic.toString());

    await program.methods
      .createStock(
        name,
        totalSupply,
        dividends,
        dividendPaymentPeriod,
        new anchor.BN(dateToGoPublic),
        priceToGoPublic,
      )
      .accounts({
        decentralizedExchangeSystem: decentralizedExchangeSystemPda,
        stockAccount: stockAccount,
        from: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const stockAccount1 = await program.account.stockAccount.fetch(stockAccount);

    console.log("Stock Account State:", stockAccount1);

    assert.strictEqual(stockAccount1.bumpOriginal, bumpStock);
    assert.strictEqual(stockAccount1.name, name);
    assert.strictEqual(stockAccount1.totalSupply.toNumber(), totalSupply.toNumber());
    assert.strictEqual(stockAccount1.supplyInPosition.toNumber(), totalSupply.toNumber());
    assert.ok(stockAccount1.dividends);
    assert.strictEqual(stockAccount1.dividendPaymentPeriod.toNumber(), dividendPaymentPeriod.toNumber());
    assert.strictEqual(stockAccount1.dateToGoPublic.toNumber(), dateToGoPublic);
    assert.strictEqual(stockAccount1.priceToGoPublic.toNumber(), priceToGoPublic.toNumber());

    // Verify decentralized exchange system state update
    const systemAccount = await program.account.systemExchangeAccount.fetch(decentralizedExchangeSystemPda);
    assert.ok(systemAccount.totalStockCompanies > 0);
  });



  it("Initializes a holder account", async () => {
    [holderAccountPda, bumpHolder] = PublicKey.findProgramAddressSync(
      [stockAccountPda.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    );

    // Execute the init_holder_account method
    await program.methods
      .initHolderAccount()
      .accounts({
        decentralizedExchangeSystem: decentralizedExchangeSystemPda,
        stockAccount: stockAccountPda,
        holderAccount: holderAccountPda,
        stockAccountPda: stockAccountPda,
        from: wallet.publicKey,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    // Fetch the holder account and verify the details
    const holderAccount = await program.account.holderAccount.fetch(holderAccountPda);

    console.log("Holder Account State:", holderAccount);

    assert.strictEqual(holderAccount.bumpOriginal, bumpHolder);
    assert.strictEqual(holderAccount.holderPubkey.toString(), wallet.publicKey.toString());
    assert.ok(holderAccount.participation);

    // Verify updates in the stock account and system account
    const stockAccount1 = await program.account.stockAccount.fetch(stockAccountPda);
    assert.ok(stockAccount1.holders.gt(new anchor.BN(0)));

    const systemAccount = await program.account.systemExchangeAccount.fetch(decentralizedExchangeSystemPda);
    assert.ok(systemAccount.totalHolders.gt(new anchor.BN(0)));
  });


  it("Buys in initial public offering", async () => {
    const amount = new anchor.BN(100);
    await program.methods
      .buyInInitialPublicOffering(ipoBuyAmount)
      .accounts({
        decentralizedExchangeSystem: decentralizedExchangeSystemPda,
        stockAccount: stockAccount,
        stockAccountPda: stockAccountPda,
        holderAccount: holderAccountPda,
        from: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    // Fetch and verify the updated stock account
    const stockAccount1 = await program.account.stockAccount.fetch(stockAccountPda);
    assert.strictEqual(stockAccount1.supplyInPosition.toNumber(), totalSupply - ipoBuyAmount.toNumber());

    // Fetch and verify the updated holder account
    const holderAccount = await program.account.holderAccount.fetch(holderAccountPda);
    assert.strictEqual(holderAccount.participation.toNumber(), ipoBuyAmount);
    console.log("Bought in Initial Public Offering:", amount.toString());
  });

  it("Initializes a sell account", async () => {
    await program.methods
      .initSellAccount()
      .accounts({
        stockAccount: stockAccount,
        sellOffer: sellAccountPda,
        stockAccountPda: stockAccountPda,
        from: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const sellAccount = await program.account.sellOrBuyAccount.fetch(sellAccountPda);
    assert.strictEqual(sellAccount.pubkey.toBase58(), wallet.publicKey.toBase58());
    assert.strictEqual(sellAccount.len, 32); // Example length check

    console.log("Init Sell Account Test Passed");
  });

  it("Creates a sell offer", async () => {
    const sellAmount = new anchor.BN(50);
    const price = new anchor.BN(120);

    await program.methods
      .sellOffer(sellAmount, price)
      .accounts({
        decentralizedExchangeSystem: decentralizedExchangeSystemPda,
        stockAccount: stockAccount,
        holderAccount: holderAccountPda,
        sellOffer: sellAccountPda,
        stockAccountPda: stockAccountPda,
        from: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    // Fetch and verify the sell offer account
    const sellOfferAccount = await program.account.sellOrBuyAccount.fetch(sellAccountPda);
    assert.strictEqual(sellOfferAccount.sellOrBuyAmount[0], sellAmount);
    assert.strictEqual(sellOfferAccount.price[0], price);

    console.log("Sell Offer Test Passed");
  });

  it("Cancels a sell offer", async () => {
    const priceToCancel = new anchor.BN(120);

    await program.methods
      .cancelSell(priceToCancel)
      .accounts({
        decentralizedExchangeSystem: decentralizedExchangeSystemPda,
        stockAccount: stockAccountPda,
        holderAccount: holderAccountPda,
        sellOffer: sellAccountPda,
        stockAccountPda: stockAccountPda,
        from: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    // Fetch and verify the sell offer account
    const sellOfferAccount = await program.account.sellOrBuyAccount.fetch(sellAccountPda);
    assert.strictEqual(sellOfferAccount.price.length, 0);
    assert.strictEqual(sellOfferAccount.sellOrBuyAmount.length, 0);

    console.log("Cancel Sell Offer Test Passed");
  });

  it("Initializes a buy account", async () => {
    await program.methods
      .initBuyAccount()
      .accounts({
        stockAccount: stockAccountPda,
        buyOffer: buyAccountPda,
        stockAccountPda: stockAccountPda,
        from: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    // Fetch and verify the buy account
    const buyAccount = await program.account.sellOrBuyAccount.fetch(buyAccountPda);
    assert.strictEqual(buyAccount.len, 128); // Replace with actual size if different
    assert.strictEqual(buyAccount.pubkey.toBase58(), wallet.publicKey.toBase58());

    console.log("Initialize Buy Account Test Passed");
  });

  it("Creates a buy offer", async () => {
    const buyAmount = new anchor.BN(50);
    const price = new anchor.BN(130);

    await program.methods
      .buyOffer(buyAmount, price)
      .accounts({
        decentralizedExchangeSystem: decentralizedExchangeSystemPda, // Mock system account
        stockAccount: stockAccountPda,
        buyOffer: buyAccountPda,
        holderAccount: holderAccountPda,
        stockAccountPda: stockAccountPda,
        buyPda: buyAccountPda,
        from: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    // Fetch and verify the buy account
    const buyAccount = await program.account.sellOrBuyAccount.fetch(buyAccountPda);
    assert.strictEqual(buyAccount.sellOrBuyAmount[0].toNumber(), buyAmount);
    assert.strictEqual(buyAccount.price[0].toNumber(), price);
    assert.strictEqual(buyAccount.pubkey.toBase58(), wallet.publicKey.toBase58());

    console.log("Buy Offer Test Passed");
  });

  it("Cancels a buy offer", async () => {
    const priceToCancel = new anchor.BN(130);

    await program.methods
      .cancelBuy(priceToCancel)
      .accounts({
        decentralizedExchangeSystem: decentralizedExchangeSystemPda,
        stockAccount: stockAccountPda,
        buyOffer: buyAccountPda,
        stockAccountPda: stockAccountPda,
        buyPda: buyAccountPda,
        from: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
    const updatedBuyOffer = await program.account.sellOrBuyAccount.fetch(buyAccountPda);

    // Perform assertions to ensure the buy offer was canceled
    assert.ok(!updatedBuyOffer.price.map((price: anchor.BN) => price.toNumber()).includes(priceToCancel.toNumber()));
    assert.ok(updatedBuyOffer.sellOrBuyAmount.length < updatedBuyOffer.price.length + 1);
  });

  it("Accepts a sell offer", async () => {
    const amount = new anchor.BN(50);

    await program.methods
      .acceptASell(amount)
      .accounts({
        decentralizedExchangeSystem: decentralizedExchangeSystemPda,
        stockAccount: stockAccount,
        sellerAccount: sellerAccount,
        buyerAccount: buyerAccount,
        sellOffer: sellAccountPda,
        stockAccountPda: stockAccountPda,
        sellPda: sellAccountPda,
        from: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    // Fetch the updated state of the sell offer account
    const updatedSellOffer = await program.account.sellOrBuyAccount.fetch(sellAccountPda);

    // Perform assertions to ensure the sell offer was accepted
    assert.ok(!updatedSellOffer.price.map((price: anchor.BN) => price.toNumber()).includes(amount.toNumber()));
    assert.ok(updatedSellOffer.sellOrBuyAmount.length < updatedSellOffer.price.length + 1);
  });

  it("Accepts a buy offer", async () => {
    const amount = new anchor.BN(50);

    await program.methods
      .acceptABuy(amount)
      .accounts({
        decentralizedExchangeSystem: decentralizedExchangeSystemPda,
        stockAccount: stockAccount,
        sellerAccount: sellerAccount,
        buyerAccount: buyerAccount,
        buyOffer: buyAccountPda,
        stockAccountPda: stockAccountPda,
        buyerPda: buyAccountPda,
        from: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    // Fetch the updated state of the buy offer account
    const updatedBuyOffer = await program.account.sellOrBuyAccount.fetch(buyAccountPda);

    // Perform assertions to ensure the buy offer was accepted
    assert.ok(!updatedBuyOffer.price.map((price: anchor.BN) => price.toNumber()).includes(amount.toNumber())); assert.ok(updatedBuyOffer.sellOrBuyAmount.length < updatedBuyOffer.price.length + 1);

    // Additional assertions for buyer and seller accounts can be added here
  });
});
